using InternManager.Api.Common.Constants;

namespace InternManager.Api.Models.Entities;

public sealed class Deliverable
{
    public Guid Id { get; set; }

    public Guid MissionId { get; set; }

    public Guid SupervisorId { get; set; }

    public Guid? InternId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Status { get; set; } = DomainStatuses.Deliverable.Draft;

    public DateTime? SubmittedDate { get; set; }

    public string FileUrl { get; set; } = string.Empty;

    public int Version { get; set; } = 1;

    public string? SupervisorComment { get; set; }

    public decimal RawProgress { get; set; }

    public int RowVersion { get; set; } = 1;

    public DateTime? OverdueNotifiedAt { get; set; }

    public DateTime? DueDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public Mission? Mission { get; set; }

    public User? Supervisor { get; set; }

    public User? Intern { get; set; }

    public ICollection<InternTask> Tasks { get; set; } = new List<InternTask>();

    public ICollection<DeliverableVersion> Versions { get; set; } = new List<DeliverableVersion>();
}
