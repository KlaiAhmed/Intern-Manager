namespace InternManager.Api.Models.Responses;

public sealed class EvaluationInternResponse
{
    public Guid Id { get; set; }

    public int TechnicalScore { get; set; }

    public int AutonomyScore { get; set; }

    public int CommunicationScore { get; set; }

    public int DeadlineRespectScore { get; set; }

    public int DeliverableQualityScore { get; set; }

    public decimal OverallScore { get; set; }

    public string? Comments { get; set; }

    public DateTime ReleasedAt { get; set; }
}