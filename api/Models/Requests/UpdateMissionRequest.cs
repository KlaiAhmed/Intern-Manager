namespace InternManager.Api.Models.Requests;

public sealed class UpdateMissionRequest
{
    public string? Title { get; init; }

    public string? Description { get; init; }

    public string[]? Skills { get; init; }

    public string? Tools { get; init; }

    public string? Level { get; init; }

    public string? Status { get; init; }

    public Guid? CoSupervisorId { get; init; }

    public bool? CoSupervisorCanReview { get; init; }

    public bool? CoSupervisorCanEval { get; init; }
}
