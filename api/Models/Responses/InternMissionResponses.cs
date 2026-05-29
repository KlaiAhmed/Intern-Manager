namespace InternManager.Api.Models.Responses;

public sealed class InternMissionHistoryResponse
{
    public IReadOnlyList<InternMissionHistoryItemResponse> Missions { get; init; } = [];
}

public sealed class InternMissionHistoryItemResponse
{
    public Guid Id { get; init; }

    public string MissionTitle { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public DateTime StartDate { get; init; }

    public DateTime? EndDate { get; init; }

    public int Progress { get; init; }

    public string SupervisorName { get; init; } = string.Empty;

    public string? CoSupervisorName { get; init; }

    public string? DepartmentName { get; init; }

    public string? Type { get; init; }

    public DateTime? AssignedAt { get; init; }
}
