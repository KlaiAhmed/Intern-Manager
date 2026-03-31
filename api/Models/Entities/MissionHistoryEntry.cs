namespace InternManager.Api.Models.Entities;

/// <summary>
/// Represents one field-level change for a mission lifecycle event.
/// </summary>
public sealed class MissionHistoryEntry
{
    public Guid Id { get; set; }

    public Guid MissionId { get; set; }

    public string Field { get; set; } = string.Empty;

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public Guid? ChangedByUserId { get; set; }

    public string ChangedBy { get; set; } = string.Empty;

    public DateTime ChangedAt { get; set; }

    public Mission? Mission { get; set; }

    public User? ChangedByUser { get; set; }
}
