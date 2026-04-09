namespace InternManager.Api.Models.Responses;

public sealed class EvaluationDueItem
{
    public Guid EvaluationId { get; init; }

    public Guid InternId { get; init; }

    public string InternName { get; init; } = string.Empty;

    public string Type { get; init; } = string.Empty;
}

public sealed class EvaluationCompletedItem
{
    public Guid EvaluationId { get; init; }

    public Guid InternId { get; init; }

    public string InternName { get; init; } = string.Empty;

    public string Type { get; init; } = string.Empty;

    public double AverageScore { get; init; }

    public DateTime SubmittedAt { get; init; }
}

public sealed class EvaluationStatusResponse
{
    public List<EvaluationDueItem> Due { get; init; } = [];

    public List<EvaluationCompletedItem> Completed { get; init; } = [];
}
