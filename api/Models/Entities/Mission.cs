/// <summary>
/// Represents a supervisor mission assigned to an intern.
/// </summary>
namespace InternManager.Api.Models.Entities;

public sealed class Mission
{
    public Guid Id { get; set; }

    public Guid SupervisorId { get; set; }

    public Guid? InternId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string SkillsJson { get; set; } = "[]";

    public string Tools { get; set; } = string.Empty;

    public string Level { get; set; } = string.Empty;

    public string Status { get; set; } = "active";

    public DateTime CreatedAt { get; set; }

    public User? Supervisor { get; set; }

    public User? Intern { get; set; }

    public ICollection<Deliverable> Deliverables { get; set; } = new List<Deliverable>();

    public ICollection<MissionHistoryEntry> HistoryEntries { get; set; } = new List<MissionHistoryEntry>();
}
