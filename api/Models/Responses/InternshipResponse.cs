namespace InternManager.Api.Models.Responses;

public sealed class InternshipResponse
{
    public Guid Id { get; init; }

    public string MissionTitle { get; init; } = string.Empty;

    public Guid? InternId { get; init; }

    public string? InternName { get; init; }

    public IReadOnlyList<Guid> InternIds { get; init; } = Array.Empty<Guid>();

    public IReadOnlyList<string> InternNames { get; init; } = Array.Empty<string>();

    public Guid SupervisorId { get; init; }

    public string? SupervisorName { get; init; }

    public Guid? CoSupervisorId { get; init; }

    public string? Department { get; init; }

    public string? Type { get; init; }

    public string Status { get; init; } = string.Empty;

    public DateTime StartDate { get; init; }

    public DateTime? EndDate { get; init; }

    public string Objectives { get; init; } = string.Empty;
}
