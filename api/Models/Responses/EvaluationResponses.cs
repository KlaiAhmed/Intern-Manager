namespace InternManager.Api.Models.Responses;

public sealed class EvaluationCriteriaResponse
{
    public int Technical { get; init; }

    public int Autonomy { get; init; }

    public int Communication { get; init; }

    public int DeadlineRespect { get; init; }

    public int DeliverableQuality { get; init; }
}

public sealed class EvaluationListItemResponse
{
    public Guid Id { get; init; }

    public Guid SupervisorId { get; init; }

    public string SupervisorName { get; init; } = string.Empty;

    public Guid InternId { get; init; }

    public string InternName { get; init; } = string.Empty;

    public string Type { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public DateTime? SubmittedAt { get; init; }

    public string Comments { get; init; } = string.Empty;

    public EvaluationCriteriaResponse Criteria { get; init; } = new();
}

public sealed class EvaluationDetailResponse
{
    public Guid Id { get; init; }

    public Guid InternId { get; init; }

    public string Type { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public DateTime? SubmittedAt { get; init; }

    public string Comments { get; init; } = string.Empty;

    public EvaluationCriteriaResponse Criteria { get; init; } = new();
}

public sealed class InternEvaluationResponse
{
    public Guid Id { get; init; }

    public string Type { get; init; } = string.Empty;

    public EvaluationCriteriaResponse Criteria { get; init; } = new();

    public bool IsReleasedToIntern { get; init; }

    public DateTime? ReleasedAt { get; init; }

    public DateTime Date { get; init; }

    public string Comments { get; init; } = string.Empty;

    public string SupervisorName { get; init; } = string.Empty;
}

public sealed class InternEvaluationsResponse
{
    public IReadOnlyList<InternEvaluationResponse> Data { get; init; } = [];

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int Total { get; init; }
}
