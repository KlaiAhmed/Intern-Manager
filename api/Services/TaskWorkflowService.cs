using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class TaskWorkflowService(AppDbContext dbContext, ISupervisorScopeService supervisorScopeService) : ITaskWorkflowService
{
    public async Task<bool> CanSupervisorAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken)
    {
        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(supervisorId, cancellationToken);
        if (assignedInternIds.Contains(internId))
        {
            return true;
        }

        var hasAnyAssignment = await dbContext.Missions
            .AsNoTracking()
            .AnyAsync(mission => mission.InternId == internId, cancellationToken)
            || await dbContext.Deliverables
                .AsNoTracking()
                .AnyAsync(deliverable => deliverable.InternId == internId, cancellationToken)
            || await dbContext.Evaluations
                .AsNoTracking()
                .AnyAsync(evaluation => evaluation.InternId == internId, cancellationToken)
            || await dbContext.Meetings
                .AsNoTracking()
                .AnyAsync(meeting => meeting.InternId == internId, cancellationToken);

        return !hasAnyAssignment;
    }

    public async Task<int> EnsureTasksFromDeliverablesAsync(Guid internId, CancellationToken cancellationToken)
    {
        var existingDeliverableIds = await dbContext.InternTasks
            .AsNoTracking()
            .Where(task => task.InternId == internId && task.DeliverableId.HasValue)
            .Select(task => task.DeliverableId!.Value)
            .ToListAsync(cancellationToken);

        var existingDeliverableSet = existingDeliverableIds.ToHashSet();

        var missingDeliverables = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.InternId == internId && !existingDeliverableSet.Contains(deliverable.Id))
            .Select(deliverable => new
            {
                deliverable.Id,
                deliverable.Title,
                deliverable.DueDate,
                deliverable.Progress,
                deliverable.Status
            })
            .ToListAsync(cancellationToken);

        if (missingDeliverables.Count == 0)
        {
            return 0;
        }

        foreach (var deliverable in missingDeliverables)
        {
            var isComplete = deliverable.Progress >= 100 ||
                             deliverable.Status.Equals(DomainStatuses.Deliverable.Accepted, StringComparison.OrdinalIgnoreCase);

            dbContext.InternTasks.Add(new InternTask
            {
                Id = Guid.NewGuid(),
                InternId = internId,
                DeliverableId = deliverable.Id,
                Title = deliverable.Title,
                DueDate = deliverable.DueDate,
                IsComplete = isComplete,
                CompletedAt = isComplete ? DateTime.UtcNow : null,
                CreatedAt = DateTime.UtcNow
            });
        }

        return missingDeliverables.Count;
    }
}
