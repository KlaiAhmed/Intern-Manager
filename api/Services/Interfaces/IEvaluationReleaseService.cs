using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Service métier de publication des évaluations vers les interns.
/// </summary>
public interface IEvaluationReleaseService
{
    /// <summary>
    /// Publie une évaluation pour l intern.
    /// </summary>
    Task<EvaluationReleaseResponse> ReleaseAsync(
        Guid evaluationId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        CancellationToken cancellationToken);

    /// <summary>
    /// Retire la publication d une évaluation.
    /// </summary>
    Task<EvaluationReleaseResponse> UnreleaseAsync(
        Guid evaluationId,
        Guid actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken);
}
