namespace InternManager.Api.Models.Requests;

public sealed class CreateMissionRequest
{
    public string Title { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;

    public string[] Skills { get; init; } = [];

    public string Tools { get; init; } = string.Empty;

    public string Level { get; init; } = string.Empty;

    public string[] Deliverables { get; init; } = [];

    public string InternId { get; init; } = string.Empty;

    public string[] InternIds { get; init; } = [];

    public Guid? CoSupervisorId { get; init; }

    public bool CoSupervisorCanReview { get; init; }

    public bool CoSupervisorCanEval { get; init; }
}
