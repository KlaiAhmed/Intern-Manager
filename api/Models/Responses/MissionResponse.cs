namespace InternManager.Api.Models.Responses;

public sealed class MissionResponse
{
    public Guid Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public Guid SupervisorId { get; init; }

    public Guid? CoSupervisorId { get; init; }

    public bool CoSupervisorCanReview { get; init; }

    public bool CoSupervisorCanEval { get; init; }

    public decimal RawProgress { get; init; }
}
