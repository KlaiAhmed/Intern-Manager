using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using InternManager.Api.Auth;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace InternManager.Api.Services.Auth;

public sealed class AuthService(
    IAuthUserStore userStore,
    IOptions<JwtOptions> jwtOptions) : IAuthService
{
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;
    private readonly byte[] _signingKey = Encoding.UTF8.GetBytes(jwtOptions.Value.Key);
    private readonly Dictionary<string, RefreshTokenEntry> _refreshTokens = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim _refreshTokenLock = new(1, 1);

    public async Task<AuthSessionTokens?> LoginAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        var user = await userStore.FindByEmailAsync(email, cancellationToken);
        if (user is null || !PasswordHasher.VerifyPassword(password, user.PasswordHash))
        {
            return null;
        }

        await _refreshTokenLock.WaitAsync(cancellationToken);
        try
        {
            CleanupExpiredTokensNoLock(DateTime.UtcNow);
            return IssueNewSessionNoLock(user, DateTime.UtcNow);
        }
        finally
        {
            _refreshTokenLock.Release();
        }
    }

    public async Task<AuthSessionTokens?> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var oldRefreshTokenHash = HashOpaqueToken(refreshToken);

        await _refreshTokenLock.WaitAsync(cancellationToken);
        try
        {
            CleanupExpiredTokensNoLock(now);

            if (!_refreshTokens.TryGetValue(oldRefreshTokenHash, out var existingToken))
            {
                return null;
            }

            if (existingToken.ExpiresAtUtc <= now)
            {
                _refreshTokens.Remove(oldRefreshTokenHash);
                return null;
            }

            var user = await userStore.FindByUserIdAsync(existingToken.UserId, cancellationToken);
            if (user is null)
            {
                _refreshTokens.Remove(oldRefreshTokenHash);
                return null;
            }

            // Invalidation immediate pour empecher toute reutilisation de l ancien token.
            _refreshTokens.Remove(oldRefreshTokenHash);

            return IssueNewSessionNoLock(user, now);
        }
        finally
        {
            _refreshTokenLock.Release();
        }
    }

    public async Task LogoutAsync(Guid? userId, string? refreshToken, CancellationToken cancellationToken = default)
    {
        await _refreshTokenLock.WaitAsync(cancellationToken);
        try
        {
            CleanupExpiredTokensNoLock(DateTime.UtcNow);

            if (userId.HasValue)
            {
                var keysForUser = _refreshTokens
                    .Where(entry => entry.Value.UserId == userId.Value)
                    .Select(entry => entry.Key)
                    .ToList();

                foreach (var key in keysForUser)
                {
                    _refreshTokens.Remove(key);
                }
            }

            if (!string.IsNullOrWhiteSpace(refreshToken))
            {
                _refreshTokens.Remove(HashOpaqueToken(refreshToken));
            }
        }
        finally
        {
            _refreshTokenLock.Release();
        }
    }

    private AuthSessionTokens IssueNewSessionNoLock(AuthUserRecord user, DateTime now)
    {
        var accessTokenExpiresAtUtc = now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var refreshTokenExpiresAtUtc = now.AddDays(_jwtOptions.RefreshTokenDays);
        var csrfToken = GenerateOpaqueToken(32);

        var accessToken = GenerateAccessToken(user, csrfToken, accessTokenExpiresAtUtc, now);
        var refreshToken = GenerateOpaqueToken(64);

        var refreshTokenHash = HashOpaqueToken(refreshToken);
        _refreshTokens[refreshTokenHash] = new RefreshTokenEntry(user.UserId, refreshTokenExpiresAtUtc);

        return new AuthSessionTokens(
            accessToken,
            accessTokenExpiresAtUtc,
            refreshToken,
            refreshTokenExpiresAtUtc,
            csrfToken);
    }

    private string GenerateAccessToken(AuthUserRecord user, string csrfToken, DateTime expiresAtUtc, DateTime now)
    {
        var claims = new List<Claim>
        {
            new("userId", user.UserId.ToString()),
            new("email", user.Email),
            new("username", user.Email),
            new("role", user.Role),
            new("csrf", csrfToken),
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.Email),
            new(ClaimTypes.Role, user.Role)
        };

        var tokenDescriptor = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: now,
            expires: expiresAtUtc,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(_signingKey),
                SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
    }

    private static string GenerateOpaqueToken(int byteLength)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLength);
        return Convert.ToBase64String(bytes);
    }

    private static string HashOpaqueToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash);
    }

    private void CleanupExpiredTokensNoLock(DateTime utcNow)
    {
        var expiredKeys = _refreshTokens
            .Where(entry => entry.Value.ExpiresAtUtc <= utcNow)
            .Select(entry => entry.Key)
            .ToList();

        foreach (var key in expiredKeys)
        {
            _refreshTokens.Remove(key);
        }
    }

    private sealed record RefreshTokenEntry(Guid UserId, DateTime ExpiresAtUtc);
}
