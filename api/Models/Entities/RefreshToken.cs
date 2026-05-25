using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.Entities;

public sealed class RefreshToken
{
    public string Token { get; set; } = string.Empty;

    public Guid UserId { get; set; }

    public DateTime ExpiresAt { get; set; }

    // FIX L21: enforce optimistic concurrency on refresh token revocation.
    [ConcurrencyCheck]
    public DateTime? RevokedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? User { get; set; }
}
