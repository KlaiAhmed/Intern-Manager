using InternManager.Api.Common.Enums;

namespace InternManager.Api.Services.Auth;

public sealed class StubAuthUserStore(IConfiguration configuration) : IAuthUserStore
{
    private readonly AuthUserRecord _stubUser = BuildStubUser(configuration);

    public Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return Task.FromResult<AuthUserRecord?>(null);
        }

        var match = string.Equals(_stubUser.Email, email, StringComparison.OrdinalIgnoreCase)
            ? _stubUser
            : null;

        return Task.FromResult(match);
    }

    public Task<AuthUserRecord?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var match = _stubUser.UserId == userId
            ? _stubUser
            : null;

        return Task.FromResult(match);
    }

    private static AuthUserRecord BuildStubUser(IConfiguration configuration)
    {
        var email = configuration["Auth:StubUser:Email"] ?? "admin@axia.com";
        var password = configuration["Auth:StubUser:Password"] ?? "Admin@1234";
        var roleFromConfig = configuration["Auth:StubUser:Role"] ?? UserRole.Admin.ToString();
        var userIdValue = configuration["Auth:StubUser:UserId"];

        var parsedRole = Enum.TryParse<UserRole>(roleFromConfig, true, out var role)
            ? role
            : UserRole.Admin;

        var userId = Guid.TryParse(userIdValue, out var parsedUserId)
            ? parsedUserId
            : Guid.Parse("11111111-1111-1111-1111-111111111111");

        return new AuthUserRecord(
            userId,
            email,
            PasswordHasher.HashPassword(password),
            parsedRole.ToString());
    }
}
