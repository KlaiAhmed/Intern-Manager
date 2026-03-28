namespace InternManager.Api.Services.Auth;

public interface IAuthService
{
    Task<AuthSessionTokens?> LoginAsync(string email, string password, CancellationToken cancellationToken = default);
    Task<AuthSessionTokens?> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task LogoutAsync(Guid? userId, string? refreshToken, CancellationToken cancellationToken = default);
}

public sealed record AuthSessionTokens(
    string AccessToken,
    DateTime AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTime RefreshTokenExpiresAtUtc,
    string CsrfToken);
