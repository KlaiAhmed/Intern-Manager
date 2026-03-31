namespace InternManager.Api.Services.Auth;

/// <summary>
/// Defines password reset operations based on short-lived one-time tokens.
/// </summary>
public interface IPasswordResetService
{
    /// <summary>
    /// Creates a reset token for an active account matching the provided email.
    /// Returns null when no account matches.
    /// </summary>
    Task<string?> CreateResetTokenAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Applies a new password when the provided token is valid and not expired.
    /// Returns the updated user id on success, otherwise null.
    /// </summary>
    Task<Guid?> ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default);
}
