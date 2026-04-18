namespace InternManager.Api.Models.Entities;

public sealed class MissionInternAssignment
{
    public Guid MissionId { get; set; }

    public Guid InternId { get; set; }

    public DateTime AssignedAt { get; set; }

    public Mission? Mission { get; set; }

    public User? Intern { get; set; }
}
