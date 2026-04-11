namespace InternManager.Api.Models.Responses;

/// <summary>
/// Résultat d une action de publication ou retrait de publication d évaluation.
/// </summary>
public sealed class EvaluationReleaseResponse
{
    public Guid Id { get; init; }

    public bool IsReleasedToIntern { get; init; }

    public DateTime? ReleasedAt { get; init; }

    public Guid? ReleasedByUserId { get; init; }
}
