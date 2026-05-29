namespace InternManager.Api.Models.Entities;

public sealed class Mission
{
    public Guid Id { get; set; }

    public Guid SupervisorId { get; set; }

    public Guid? CoSupervisorId { get; set; }

    public Guid? InternId { get; set; }

    public string Title { get; set; } = string.Empty;

    public bool IsTitleManuallySet { get; set; }

    public string Description { get; set; } = string.Empty;

    public string SkillsJson { get; set; } = "[]";

    public string Tools { get; set; } = string.Empty;

    public Guid? InternshipTypeId { get; set; }

    public string Level { get; set; } = string.Empty;

    public string Status { get; set; } = "active";

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? Supervisor { get; set; }

    public User? CoSupervisor { get; set; }

    public User? Intern { get; set; }

    public ICollection<MissionInternAssignment> InternAssignments { get; set; } = new List<MissionInternAssignment>();

    public InternshipType? InternshipType { get; set; }

    public MissionFeatureFlags? FeatureFlags { get; set; }

    public ICollection<Deliverable> Deliverables { get; set; } = new List<Deliverable>();

    public ICollection<MissionHistoryEntry> HistoryEntries { get; set; } = new List<MissionHistoryEntry>();
}
