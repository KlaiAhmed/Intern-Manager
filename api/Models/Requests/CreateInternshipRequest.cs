namespace InternManager.Api.Models.Requests;

public class CreateInternshipRequest
{
    public string? MissionName { get; set; }

    public string? InternId { get; set; }

    public string? SupervisorId { get; set; }

    public string? CoSupervisorId { get; set; }

    public string? Department { get; set; }

    public string? Type { get; set; }

    public string? Status { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public string? Objectives { get; set; }
}
