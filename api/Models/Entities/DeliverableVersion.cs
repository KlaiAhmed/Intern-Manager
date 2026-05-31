using InternManager.Api.Common.Constants;

namespace InternManager.Api.Models.Entities;

/// <summary>
/// Represents an immutable version snapshot of a deliverable submission.
/// </summary>
public sealed class DeliverableVersion
{
    public Guid Id { get; set; }

    public Guid DeliverableId { get; set; }

    public int VersionNumber { get; set; }

    public bool IsCurrentVersion { get; set; }

    public string? FileUrl { get; set; }

    public string? GitHubUrl { get; set; }

    public string? GitHubBranch { get; set; }

    public string? Message { get; set; }

    public string Status { get; set; } = DomainStatuses.DeliverableVersion.Submitted;

    public string? SupervisorComment { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime? ValidatedAt { get; set; }

    public Guid? SubmittedByUserId { get; set; }

    public Deliverable? Deliverable { get; set; }

    public User? SubmittedByUser { get; set; }
}
