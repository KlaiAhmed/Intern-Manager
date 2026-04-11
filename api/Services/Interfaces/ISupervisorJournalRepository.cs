using InternManager.Api.Models.Entities;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Accès aux données de supervision du journal intern.
/// </summary>
public interface ISupervisorJournalRepository
{
    /// <summary>
    /// Vérifie l existence d un intern.
    /// </summary>
    Task<bool> InternExistsAsync(Guid internId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne toutes les entrées de journal d un intern.
    /// </summary>
    Task<IReadOnlyList<JournalEntry>> GetEntriesForInternAsync(Guid internId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne une entrée de journal par identifiant.
    /// </summary>
    Task<JournalEntry?> GetEntryByIdAsync(Guid entryId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne un commentaire de journal par identifiant.
    /// </summary>
    Task<JournalComment?> GetCommentByIdAsync(int commentId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne les liens critères d évaluation d une entrée.
    /// </summary>
    Task<IReadOnlyList<JournalEvaluationLink>> GetLinksForEntryAsync(Guid entryId, CancellationToken cancellationToken);

    /// <summary>
    /// Ajoute un commentaire.
    /// </summary>
    void AddComment(JournalComment comment);

    /// <summary>
    /// Supprime un commentaire.
    /// </summary>
    void RemoveComment(JournalComment comment);

    /// <summary>
    /// Supprime une plage de liens d évaluation.
    /// </summary>
    void RemoveLinks(IEnumerable<JournalEvaluationLink> links);

    /// <summary>
    /// Ajoute des liens d évaluation.
    /// </summary>
    void AddLinks(IEnumerable<JournalEvaluationLink> links);

    /// <summary>
    /// Met à jour une entrée de journal.
    /// </summary>
    void UpdateEntry(JournalEntry entry);

    /// <summary>
    /// Ajoute une entrée d audit log.
    /// </summary>
    void AddAuditLog(AuditLog auditLog);

    /// <summary>
    /// Ajoute une notification intern.
    /// </summary>
    void AddInternNotification(InternNotification notification);

    /// <summary>
    /// Persiste les changements.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
