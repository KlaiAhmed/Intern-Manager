namespace InternManager.Api.Models.Entities;

/// <summary>
/// Represents an immutable version snapshot of a deliverable submission.
/// </summary>
public sealed class DeliverableVersion
{
    public Guid Id { get; set; }

    public Guid DeliverableId { get; set; }

    public int VersionNumber { get; set; }

    public string FileUrl { get; set; } = string.Empty;

    public string Status { get; set; } = "submitted";

    public string? SupervisorComment { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime? ValidatedAt { get; set; }

    public Deliverable? Deliverable { get; set; }
}
