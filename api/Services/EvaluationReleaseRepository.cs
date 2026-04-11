using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

/// <summary>
/// Dépôt EF Core pour la publication des évaluations.
/// </summary>
public sealed class EvaluationReleaseRepository(AppDbContext dbContext) : IEvaluationReleaseRepository
{
    /// <inheritdoc />
    public Task<Evaluation?> GetByIdAsync(Guid evaluationId, CancellationToken cancellationToken)
    {
        return dbContext.Evaluations
            .FirstOrDefaultAsync(item => item.Id == evaluationId, cancellationToken);
    }

    /// <inheritdoc />
    public void Update(Evaluation evaluation)
    {
        dbContext.Evaluations.Update(evaluation);
    }

    /// <inheritdoc />
    public void AddAuditLog(AuditLog auditLog)
    {
        dbContext.AuditLogs.Add(auditLog);
    }

    /// <inheritdoc />
    public void AddInternNotification(InternNotification notification)
    {
        dbContext.InternNotifications.Add(notification);
    }

    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
