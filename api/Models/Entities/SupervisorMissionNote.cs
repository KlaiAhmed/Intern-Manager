using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.Entities;

public sealed class SupervisorMissionNote
{
    public Guid Id { get; set; }

    public Guid SupervisorId { get; set; }

    public Guid MissionId { get; set; }

    [Required]
    [MaxLength(4000)]
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public User? Supervisor { get; set; }

    public Mission? Mission { get; set; }
}
