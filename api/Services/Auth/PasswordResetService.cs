using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Options;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace InternManager.Api.Services.Auth;

/// <summary>
/// Stores and validates one-time password reset codes.
/// </summary>
public sealed class PasswordResetService(
    AppDbContext dbContext,
    IEmailService emailService,
    IOptions<JwtOptions> jwtOptions,
    ILogger<PasswordResetService> logger) : IPasswordResetService
{
    private static readonly TimeSpan ResetCodeLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan VerificationTokenLifetime = TimeSpan.FromMinutes(10);

    private readonly JwtOptions _jwtOptions = jwtOptions.Value;
    private readonly byte[] _signingKey = Encoding.UTF8.GetBytes(jwtOptions.Value.Key);

    public async Task CreateResetCodeAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users
            .FirstOrDefaultAsync(
                current => current.Status == UserStatus.Active &&
                           EF.Functions.Collate(current.Email, "SQL_Latin1_General_CP1_CI_AS") == normalizedEmail,
                cancellationToken);

        if (user is null)
        {
            return;
        }

        var now = DateTime.UtcNow;
        var activeTokens = await dbContext.PasswordResetTokens
            .Where(token => token.UserId == user.Id && !token.IsUsed)
            .ToListAsync(cancellationToken);

        foreach (var activeToken in activeTokens)
        {
            activeToken.IsUsed = true;
        }

        var plainCode = GenerateSixDigitCode();
        var expiresAt = now.Add(ResetCodeLifetime);
        var tokenHash = HashToken(plainCode);

        dbContext.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = expiresAt,
            IsUsed = false,
            CreatedAt = now
        });

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = user.Id,
            Actor = user.Email,
            Action = "auth.password_reset.request",
            Entity = $"user:{user.Id}",
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await emailService.SendPasswordResetCodeAsync(user.Email, plainCode, expiresAt, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Failed to send password reset code email for user {UserId}.", user.Id);
            throw;
        }
    }

    public async Task<string?> VerifyResetCodeAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var normalizedCode = code.Trim();
        if (normalizedCode.Length != 6 || normalizedCode.Any(character => !char.IsDigit(character)))
        {
            return null;
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                current => current.Status == UserStatus.Active &&
                           EF.Functions.Collate(current.Email, "SQL_Latin1_General_CP1_CI_AS") == normalizedEmail,
                cancellationToken);

        if (user is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;

        var resetToken = await dbContext.PasswordResetTokens
            .Where(current => current.UserId == user.Id && !current.IsUsed && current.ExpiresAt > now)
            .OrderByDescending(current => current.CreatedAt)
            .FirstOrDefaultAsync(
                cancellationToken);

        if (resetToken is null || !HashMatches(normalizedCode, resetToken.TokenHash))
        {
            return null;
        }

        return GenerateVerificationToken(resetToken.Id, user.Id, now);
    }

    public async Task<Guid?> ResetPasswordAsync(string verificationToken, string newPassword, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(verificationToken) || string.IsNullOrWhiteSpace(newPassword))
        {
            return null;
        }

        if (!TryReadVerificationTokenClaims(verificationToken.Trim(), out var userId, out var resetTokenId))
        {
            return null;
        }

        var now = DateTime.UtcNow;

        var resetToken = await dbContext.PasswordResetTokens
            .Include(current => current.User)
            .FirstOrDefaultAsync(
                current => current.Id == resetTokenId &&
                           current.UserId == userId &&
                           !current.IsUsed &&
                           current.ExpiresAt > now,
                cancellationToken);

        if (resetToken is null || resetToken.User is null || resetToken.User.Status != UserStatus.Active)
        {
            return null;
        }

        var normalizedPassword = newPassword.Trim();
        if (!PasswordPolicyValidator.IsValid(normalizedPassword))
        {
            return null;
        }

        resetToken.User.PasswordHash = PasswordHasher.HashPassword(normalizedPassword);
        resetToken.IsUsed = true;

        var siblingTokens = await dbContext.PasswordResetTokens
            .Where(current => current.UserId == resetToken.UserId && current.Id != resetToken.Id && !current.IsUsed)
            .ToListAsync(cancellationToken);

        foreach (var siblingToken in siblingTokens)
        {
            siblingToken.IsUsed = true;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = resetToken.UserId,
            Actor = resetToken.User.Email,
            Action = "auth.password_reset.complete",
            Entity = $"user:{resetToken.UserId}",
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return resetToken.UserId;
    }

    private string GenerateVerificationToken(Guid resetTokenId, Guid userId, DateTime now)
    {
        var tokenDescriptor = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims:
            [
                new Claim("purpose", "password_reset"),
                new Claim("userId", userId.ToString()),
                new Claim("resetTokenId", resetTokenId.ToString())
            ],
            notBefore: now,
            expires: now.Add(VerificationTokenLifetime),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(_signingKey),
                SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
    }

    private bool TryReadVerificationTokenClaims(string verificationToken, out Guid userId, out Guid resetTokenId)
    {
        userId = Guid.Empty;
        resetTokenId = Guid.Empty;

        var tokenHandler = new JwtSecurityTokenHandler();

        try
        {
            var principal = tokenHandler.ValidateToken(
                verificationToken,
                new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(_signingKey),
                    ValidateIssuer = true,
                    ValidIssuer = _jwtOptions.Issuer,
                    ValidateAudience = true,
                    ValidAudience = _jwtOptions.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                },
                out _);

            var purpose = principal.FindFirstValue("purpose");
            var userIdClaim = principal.FindFirstValue("userId");
            var resetTokenIdClaim = principal.FindFirstValue("resetTokenId");

            if (!string.Equals(purpose, "password_reset", StringComparison.Ordinal) ||
                !Guid.TryParse(userIdClaim, out userId) ||
                !Guid.TryParse(resetTokenIdClaim, out resetTokenId))
            {
                return false;
            }

            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static string GenerateSixDigitCode()
    {
        return RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
    }

    private static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hashBytes);
    }

    private static bool HashMatches(string plainValue, string storedHash)
    {
        var incomingHash = HashToken(plainValue);

        try
        {
            var incomingBytes = Convert.FromHexString(incomingHash);
            var storedBytes = Convert.FromHexString(storedHash);
            return CryptographicOperations.FixedTimeEquals(incomingBytes, storedBytes);
        }
        catch (FormatException)
        {
            return string.Equals(incomingHash, storedHash, StringComparison.OrdinalIgnoreCase);
        }
    }
}
