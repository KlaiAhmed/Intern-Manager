namespace InternManager.Api.Models.Entities;

/// <summary>
/// Represents a tagged skill associated to an intern profile.
/// </summary>
public sealed class InternProfileSkill
{
    public Guid InternProfileId { get; set; }

    public Guid SkillId { get; set; }

    public DateTime CreatedAt { get; set; }

    public InternProfile? InternProfile { get; set; }

    public Skill? Skill { get; set; }
}
