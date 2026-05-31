namespace InternManager.Api.Models.Entities;

public sealed class EntityHistoryEntry
{
    public Guid Id { get; set; }

    public string EntityType { get; set; } = string.Empty;

    public Guid EntityId { get; set; }

    public string Action { get; set; } = string.Empty;

    public Guid? ActorId { get; set; }

    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Actor { get; set; }
}
