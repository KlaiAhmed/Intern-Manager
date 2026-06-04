namespace InternManager.Api.Models.Responses;

public sealed class MissionProgressResponse
{
    public string MissionId { get; init; } = string.Empty;

    public int TotalInterns { get; init; }

    public int TaskCount { get; init; }

    public int TaskDoneCount { get; init; }

    public int DeliverableCount { get; init; }

    public int DeliverableApprovedCount { get; init; }

    public double ProgressPercent { get; init; }

    public IReadOnlyList<InternProgressEntry> PerInternProgress { get; init; } = [];
}

public sealed class InternProgressEntry
{
    public string InternId { get; init; } = string.Empty;

    public string InternFullName { get; init; } = string.Empty;

    public int TaskCount { get; init; }

    public int TaskDoneCount { get; init; }

    public int DeliverableCount { get; init; }

    public int DeliverableApprovedCount { get; init; }

    public double ProgressPercent { get; init; }
}
