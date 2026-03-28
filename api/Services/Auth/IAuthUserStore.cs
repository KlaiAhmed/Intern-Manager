namespace InternManager.Api.Services.Auth;

public interface IAuthUserStore
{
    Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<AuthUserRecord?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}

public sealed record AuthUserRecord(
    Guid UserId,
    string Email,
    string PasswordHash,
    string Role);
