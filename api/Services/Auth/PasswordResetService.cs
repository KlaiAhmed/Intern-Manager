using System.Security.Cryptography;
using System.Text;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services.Auth;

/// <summary>
/// Stores and validates one-time password reset tokens.
/// </summary>
public sealed class PasswordResetService(AppDbContext dbContext) : IPasswordResetService
{
    private static readonly TimeSpan ResetTokenLifetime = TimeSpan.FromHours(1);

    public async Task<string?> CreateResetTokenAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users
            .FirstOrDefaultAsync(
                current => current.Status == UserStatus.Active &&
                           EF.Functions.Collate(current.Email, "SQL_Latin1_General_CP1_CI_AS") == normalizedEmail,
                cancellationToken);

        if (user is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var activeTokens = await dbContext.PasswordResetTokens
            .Where(token => token.UserId == user.Id && token.UsedAt == null && token.ExpiresAt > now)
            .ToListAsync(cancellationToken);

        foreach (var activeToken in activeTokens)
        {
            activeToken.UsedAt = now;
        }

        var plainToken = GenerateOpaqueToken(48);
        var tokenHash = HashToken(plainToken);

        dbContext.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = now.Add(ResetTokenLifetime),
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
        return plainToken;
    }

    public async Task<Guid?> ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(newPassword))
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var tokenHash = HashToken(token.Trim());

        var resetToken = await dbContext.PasswordResetTokens
            .Include(current => current.User)
            .FirstOrDefaultAsync(
                current => current.TokenHash == tokenHash &&
                           current.UsedAt == null &&
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
        resetToken.UsedAt = now;

        var siblingTokens = await dbContext.PasswordResetTokens
            .Where(current => current.UserId == resetToken.UserId && current.Id != resetToken.Id && current.UsedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var siblingToken in siblingTokens)
        {
            siblingToken.UsedAt = now;
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

    private static string GenerateOpaqueToken(int byteLength)
    {
        var randomBytes = RandomNumberGenerator.GetBytes(byteLength);
        return Convert.ToBase64String(randomBytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hashBytes);
    }
}
