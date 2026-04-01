using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Entities;

/// <summary>
/// Represents the detailed profile of an intern.
/// </summary>
public sealed class InternProfile
{
    public Guid Id { get; set; }

    public Guid InternId { get; set; }

    public string School { get; set; } = string.Empty;

    public string Specialty { get; set; } = string.Empty;

    public string CompetenciesJson { get; set; } = "[]";

    public string Experience { get; set; } = string.Empty;

    public string? CvFileUrl { get; set; }

    public InternLifecycleStatus Status { get; set; } = InternLifecycleStatus.INCOMPLETE;

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public User? Intern { get; set; }

    public ICollection<InternProfileSkill> Skills { get; set; } = new List<InternProfileSkill>();
}
