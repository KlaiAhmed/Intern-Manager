using InternManager.Api.Models.Entities;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Accès aux données pour la publication des évaluations.
/// </summary>
public interface IEvaluationReleaseRepository
{
    /// <summary>
    /// Retourne une évaluation par identifiant.
    /// </summary>
    Task<Evaluation?> GetByIdAsync(Guid evaluationId, CancellationToken cancellationToken);

    /// <summary>
    /// Marque une évaluation comme modifiée.
    /// </summary>
    void Update(Evaluation evaluation);

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
