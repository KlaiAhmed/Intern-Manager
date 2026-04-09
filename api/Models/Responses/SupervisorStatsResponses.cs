namespace InternManager.Api.Models.Responses;

public sealed class AvgValidationDelayResponse
{
    public double Days { get; init; }

    public int SampleSize { get; init; }
}

public sealed class SupervisorWorkloadResponse
{
    public int CurrentInternCount { get; init; }

    public int? MaxCapacity { get; init; }

    public int? UtilizationPercent { get; init; }

    public int PfeCount { get; init; }

    public int SummerCount { get; init; }

    public int OtherCount { get; init; }
}

public sealed class DelayAlertItemResponse
{
    public Guid InternId { get; init; }

    public string InternName { get; init; } = string.Empty;

    public Guid DeliverableId { get; init; }

    public string DeliverableTitle { get; init; } = string.Empty;

    public DateTime DueDate { get; init; }

    public int DaysOverdue { get; init; }

    public string Severity { get; init; } = string.Empty;
}

public sealed class DelaysAlertsResponse
{
    public List<DelayAlertItemResponse> Data { get; init; } = [];

    public int Total { get; init; }
}
