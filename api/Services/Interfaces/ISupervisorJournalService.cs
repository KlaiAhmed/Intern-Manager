using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Service métier de supervision du journal intern.
/// </summary>
public interface ISupervisorJournalService
{
    /// <summary>
    /// Retourne toutes les entrées de journal d un intern pour supervision.
    /// </summary>
    Task<IReadOnlyList<SupervisorJournalEntryResponse>> GetInternJournalAsync(
        Guid internId,
        Guid actorUserId,
        bool isAdminScope,
        CancellationToken cancellationToken);

    /// <summary>
    /// Crée un commentaire superviseur sur une entrée.
    /// </summary>
    Task<SupervisorJournalCommentResponse> AddCommentAsync(
        Guid entryId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        string content,
        CancellationToken cancellationToken);

    /// <summary>
    /// Supprime un commentaire.
    /// </summary>
    Task DeleteCommentAsync(
        Guid entryId,
        int commentId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        CancellationToken cancellationToken);

    /// <summary>
    /// Remplace les liens critères d évaluation d une entrée.
    /// </summary>
    Task<IReadOnlyList<SupervisorJournalEvaluationLinkResponse>> ReplaceEvaluationLinksAsync(
        Guid entryId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        IReadOnlyCollection<JournalEvaluationCriteria> criteria,
        CancellationToken cancellationToken);

    /// <summary>
    /// Marque une entrée comme revue.
    /// </summary>
    Task MarkReviewedAsync(
        Guid entryId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        CancellationToken cancellationToken);
}
