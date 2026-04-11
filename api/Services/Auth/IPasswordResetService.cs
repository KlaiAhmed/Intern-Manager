namespace InternManager.Api.Services.Auth;

/// <summary>
/// Defines password reset operations based on short-lived one-time reset codes.
/// </summary>
public interface IPasswordResetService
{
    /// <summary>
    /// Creates and sends a short-lived reset code for an active account matching the provided email.
    /// The method is intentionally silent when no account matches.
    /// </summary>
    Task CreateResetCodeAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates a reset code and returns a short-lived verification token on success.
    /// Returns null when the code is invalid or expired.
    /// </summary>
    Task<string?> VerifyResetCodeAsync(string email, string code, CancellationToken cancellationToken = default);

    /// <summary>
    /// Applies a new password when the provided verification token is valid and not expired.
    /// Returns the updated user id on success, otherwise null.
    /// </summary>
    Task<Guid?> ResetPasswordAsync(string verificationToken, string newPassword, CancellationToken cancellationToken = default);
}
