namespace InternManager.Api.Models.Responses;

public sealed class EvaluationResponse
{
    public Guid Id { get; init; }

    public Guid InternId { get; init; }

    public Guid SupervisorId { get; init; }

    public string Type { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public decimal? OverallScore { get; init; }

    public DateTime? ReleasedAt { get; init; }

    public string? PrivateNotes { get; init; }
}
