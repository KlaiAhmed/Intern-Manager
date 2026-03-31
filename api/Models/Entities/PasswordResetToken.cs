namespace InternManager.Api.Models.Entities;

/// <summary>
/// Represents a one-time token used to reset a user password.
/// </summary>
public sealed class PasswordResetToken
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? User { get; set; }
}
