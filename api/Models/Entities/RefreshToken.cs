namespace InternManager.Api.Models.Entities;

public sealed class RefreshToken
{
    public string Token { get; set; } = string.Empty;

    public Guid UserId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? User { get; set; }
}
