using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Services;

/// <summary>
/// Service métier de publication d évaluations vers les interns.
/// </summary>
public sealed class EvaluationReleaseService(
    IEvaluationReleaseRepository repository,
    ISupervisorScopeService supervisorScopeService) : IEvaluationReleaseService
{
    /// <inheritdoc />
    public async Task<EvaluationReleaseResponse> ReleaseAsync(
        Guid evaluationId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        CancellationToken cancellationToken)
    {
        var evaluation = await repository.GetByIdAsync(evaluationId, cancellationToken);
        if (evaluation is null)
        {
            throw new KeyNotFoundException("Evaluation not found.");
        }

        if (!isAdminScope)
        {
            var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(actorUserId, cancellationToken);
            if (!assignedInternIds.Contains(evaluation.InternId))
            {
                throw new UnauthorizedAccessException("Only assigned supervisor can release this evaluation.");
            }
        }

        if (!string.Equals(evaluation.Status, DomainStatuses.Evaluation.Submitted, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only submitted evaluations can be released.");
        }

        if (!evaluation.IsReleasedToIntern)
        {
            var now = DateTime.UtcNow;
            evaluation.IsReleasedToIntern = true;
            evaluation.ReleasedAt = now;
            evaluation.ReleasedByUserId = actorUserId;

            repository.Update(evaluation);
            repository.AddAuditLog(new Models.Entities.AuditLog
            {
                ActorUserId = actorUserId,
                Actor = actorDisplayName,
                Action = "evaluation.release",
                Entity = $"evaluation:{evaluation.Id}",
                Timestamp = now
            });

            repository.AddInternNotification(new Models.Entities.InternNotification
            {
                InternId = evaluation.InternId,
                Type = InternNotificationType.EvaluationReleased,
                Message = "A new evaluation is now available in your dashboard.",
                RelatedEntityId = null,
                IsRead = false,
                CreatedAt = now
            });

            await repository.SaveChangesAsync(cancellationToken);
        }

        return Map(evaluation);
    }

    /// <inheritdoc />
    public async Task<EvaluationReleaseResponse> UnreleaseAsync(
        Guid evaluationId,
        Guid actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken)
    {
        var evaluation = await repository.GetByIdAsync(evaluationId, cancellationToken);
        if (evaluation is null)
        {
            throw new KeyNotFoundException("Evaluation not found.");
        }

        if (evaluation.IsReleasedToIntern)
        {
            evaluation.IsReleasedToIntern = false;
            evaluation.ReleasedAt = null;
            evaluation.ReleasedByUserId = null;

            repository.Update(evaluation);
            repository.AddAuditLog(new Models.Entities.AuditLog
            {
                ActorUserId = actorUserId,
                Actor = actorDisplayName,
                Action = "evaluation.unrelease",
                Entity = $"evaluation:{evaluation.Id}",
                Timestamp = DateTime.UtcNow
            });

            await repository.SaveChangesAsync(cancellationToken);
        }

        return Map(evaluation);
    }

    private static EvaluationReleaseResponse Map(Models.Entities.Evaluation evaluation)
    {
        return new EvaluationReleaseResponse
        {
            Id = evaluation.Id,
            IsReleasedToIntern = evaluation.IsReleasedToIntern,
            ReleasedAt = evaluation.ReleasedAt,
            ReleasedByUserId = evaluation.ReleasedByUserId
        };
    }
}
