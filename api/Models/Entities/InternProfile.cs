using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Entities;

/// <summary>
/// Represents the detailed profile of an intern.
/// </summary>
public sealed class InternProfile
{
    public Guid Id { get; set; }

    public Guid InternId { get; set; }

    public Guid? UniversityId { get; set; }

    public string Major { get; set; } = string.Empty;

    public string CurrentYearOfStudy { get; set; } = string.Empty;

    public DateTime? ExpectedGraduationDate { get; set; }

    public WorkPreference? WorkPreference { get; set; }

    public string? PhoneNumber { get; set; }

    public string? CvFileUrl { get; set; }

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public User? Intern { get; set; }

    public ICollection<InternProfileSkill> Skills { get; set; } = new List<InternProfileSkill>();
}
