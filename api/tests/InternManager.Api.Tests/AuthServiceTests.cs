using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Options;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Auth;
using InternManager.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace InternManager.Api.Tests;

public sealed class AuthServiceTests
{
    [Theory]
    [InlineData("", "Password1!")]
    [InlineData("user@example.com", "")]
    [InlineData("missing@example.com", "Password1!")]
    [InlineData("user@example.com", "WrongPassword1!")]
    public async Task LoginAsync_ReturnsNullForMissingOrInvalidCredentials(string email, string password)
    {
        await using var dbContext = TestDbContext.Create();
        var userId = Guid.NewGuid();
        dbContext.Users.Add(TestUsers.Create(userId, UserRole.Admin, "user@example.com"));
        await dbContext.SaveChangesAsync();

        var store = new FakeAuthUserStore(
            new AuthUserRecord(
                userId,
                "user@example.com",
                BCrypt.Net.BCrypt.HashPassword("Password1!"),
                UserRole.Admin.ToString()));
        var service = new AuthService(store, dbContext, Options.Create(CreateJwtOptions()));

        var result = await service.LoginAsync(email, password, rememberMe: false);

        Assert.Null(result);
        Assert.Empty(dbContext.RefreshTokens);
    }

    [Fact]
    public async Task LoginAsync_IssuesSignedJwtStoresOnlyRefreshTokenHashAndAuditsLogin()
    {
        await using var dbContext = TestDbContext.Create();
        var userId = Guid.NewGuid();
        dbContext.Users.Add(TestUsers.Create(userId, UserRole.Supervisor, "supervisor@example.com"));
        await dbContext.SaveChangesAsync();

        var store = new FakeAuthUserStore(
            new AuthUserRecord(
                userId,
                "supervisor@example.com",
                BCrypt.Net.BCrypt.HashPassword("Password1!"),
                UserRole.Supervisor.ToString()));
        var service = new AuthService(store, dbContext, Options.Create(CreateJwtOptions()));

        var result = await service.LoginAsync(" supervisor@example.com ", "Password1!", rememberMe: true);

        Assert.NotNull(result);
        Assert.NotEmpty(result!.AccessToken);
        Assert.NotEmpty(result.RefreshToken);
        Assert.NotEmpty(result.CsrfToken);
        Assert.True(result.RefreshTokenExpiresAtUtc > DateTime.UtcNow.AddDays(6));

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.AccessToken);
        Assert.Equal("AxiaInternManager", jwt.Issuer);
        Assert.Contains(jwt.Audiences, audience => audience == "AxiaInternManagerClient");
        Assert.Contains(jwt.Claims, claim => claim.Type == "userId" && claim.Value == userId.ToString());
        Assert.Contains(jwt.Claims, claim => claim.Type == "csrf" && claim.Value == result.CsrfToken);
        Assert.Contains(jwt.Claims, claim => claim.Type == "role" && claim.Value == UserRole.Supervisor.ToString());

        var storedToken = await dbContext.RefreshTokens.SingleAsync();
        Assert.NotEqual(result.RefreshToken, storedToken.Token);
        Assert.Equal(Sha256Hex(result.RefreshToken), storedToken.Token);
        Assert.Null(storedToken.RevokedAt);

        var user = await dbContext.Users.SingleAsync(user => user.Id == userId);
        Assert.NotNull(user.LastLoginAt);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "auth.login" && log.Actor == "supervisor@example.com");
    }

    [Fact]
    public async Task LoginAsync_CleansUpExpiredRefreshTokensWithoutTouchingActiveOrRevokedTokens()
    {
        await using var dbContext = TestDbContext.Create();
        var userId = Guid.NewGuid();
        var baselineNow = DateTime.UtcNow;
        var alreadyRevokedAt = baselineNow.AddHours(-4);

        dbContext.Users.Add(TestUsers.Create(userId, UserRole.Admin, "admin@example.com"));
        dbContext.RefreshTokens.AddRange(
            new RefreshToken
            {
                Token = "expired-unrevoked-token",
                UserId = userId,
                CreatedAt = baselineNow.AddDays(-4),
                ExpiresAt = baselineNow.AddDays(-2)
            },
            new RefreshToken
            {
                Token = "expired-revoked-token",
                UserId = userId,
                CreatedAt = baselineNow.AddDays(-6),
                ExpiresAt = baselineNow.AddDays(-3),
                RevokedAt = alreadyRevokedAt
            },
            new RefreshToken
            {
                Token = "active-token",
                UserId = userId,
                CreatedAt = baselineNow.AddHours(-3),
                ExpiresAt = baselineNow.AddDays(2)
            });
        await dbContext.SaveChangesAsync();

        var store = new FakeAuthUserStore(
            new AuthUserRecord(userId, "admin@example.com", BCrypt.Net.BCrypt.HashPassword("Password1!"), "Admin"));
        var service = new AuthService(store, dbContext, Options.Create(CreateJwtOptions()));

        var result = await service.LoginAsync("admin@example.com", "Password1!", rememberMe: false);

        Assert.NotNull(result);

        var expiredUnrevoked = await dbContext.RefreshTokens.SingleAsync(token => token.Token == "expired-unrevoked-token");
        var expiredRevoked = await dbContext.RefreshTokens.SingleAsync(token => token.Token == "expired-revoked-token");
        var active = await dbContext.RefreshTokens.SingleAsync(token => token.Token == "active-token");

        Assert.NotNull(expiredUnrevoked.RevokedAt);
        Assert.Equal(alreadyRevokedAt, expiredRevoked.RevokedAt);
        Assert.Null(active.RevokedAt);
    }

    [Fact]
    public async Task RefreshAsync_RotatesValidTokenAndRejectsReuse()
    {
        await using var dbContext = TestDbContext.Create();
        var userId = Guid.NewGuid();
        var rawRefreshToken = "refresh-token-value";
        dbContext.Users.Add(TestUsers.Create(userId, UserRole.Intern, "intern@example.com"));
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Token = Sha256Hex(rawRefreshToken),
            UserId = userId,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(5)
        });
        await dbContext.SaveChangesAsync();

        var store = new FakeAuthUserStore(
            new AuthUserRecord(userId, "intern@example.com", BCrypt.Net.BCrypt.HashPassword("Password1!"), "Intern"));
        var service = new AuthService(store, dbContext, Options.Create(CreateJwtOptions()));

        var result = await service.RefreshAsync(rawRefreshToken);
        var reuseResult = await service.RefreshAsync(rawRefreshToken);

        Assert.NotNull(result);
        Assert.Null(reuseResult);
        Assert.Equal(2, await dbContext.RefreshTokens.CountAsync());
        Assert.NotNull(await dbContext.RefreshTokens.SingleAsync(token => token.Token == Sha256Hex(rawRefreshToken)).ContinueWith(task => task.Result.RevokedAt));
        Assert.DoesNotContain(dbContext.RefreshTokens, token => token.Token == result!.RefreshToken);
    }

    [Fact]
    public async Task RefreshAsync_RevokesTokenWhenUserNoLongerExists()
    {
        await using var dbContext = TestDbContext.Create();
        var userId = Guid.NewGuid();
        var rawRefreshToken = "orphan-token";
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Token = Sha256Hex(rawRefreshToken),
            UserId = userId,
            CreatedAt = DateTime.UtcNow.AddHours(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        });
        await dbContext.SaveChangesAsync();

        var service = new AuthService(new FakeAuthUserStore(null), dbContext, Options.Create(CreateJwtOptions()));

        var result = await service.RefreshAsync(rawRefreshToken);

        Assert.Null(result);
        Assert.NotNull((await dbContext.RefreshTokens.SingleAsync()).RevokedAt);
    }

    [Fact]
    public async Task LogoutAsync_RevokesByUserAndHashedRefreshToken()
    {
        await using var dbContext = TestDbContext.Create();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        dbContext.RefreshTokens.AddRange(
            new RefreshToken
            {
                Token = "user-token",
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(1)
            },
            new RefreshToken
            {
                Token = Sha256Hex("specific-token"),
                UserId = otherUserId,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(1)
            });
        await dbContext.SaveChangesAsync();

        var service = new AuthService(new FakeAuthUserStore(null), dbContext, Options.Create(CreateJwtOptions()));

        await service.LogoutAsync(userId, "specific-token");

        Assert.All(dbContext.RefreshTokens, token => Assert.NotNull(token.RevokedAt));
    }

    private static JwtOptions CreateJwtOptions()
    {
        return new JwtOptions
        {
            Key = "unit-test-signing-key-that-is-long-enough-for-hmac-sha256",
            Issuer = "AxiaInternManager",
            Audience = "AxiaInternManagerClient",
            AccessTokenMinutes = 15,
            RefreshTokenDays = 7
        };
    }

    private static string Sha256Hex(string value)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    }

    private sealed class FakeAuthUserStore(AuthUserRecord? user) : IAuthUserStore
    {
        public Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            var match = user is not null && string.Equals(user.Email, email.Trim(), StringComparison.OrdinalIgnoreCase)
                ? user
                : null;

            return Task.FromResult(match);
        }

        public Task<AuthUserRecord?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var match = user is not null && user.UserId == userId
                ? user
                : null;

            return Task.FromResult(match);
        }
    }
}
