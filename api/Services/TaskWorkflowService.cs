using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class TaskWorkflowService(AppDbContext dbContext, ISupervisorScopeService supervisorScopeService) : ITaskWorkflowService
{
    // REMOVED: legacy task-from-deliverable sync (Phase 1 - 1:1 anti-pattern eliminated)
    public async Task<bool> CanSupervisorAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken)
    {
        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(supervisorId, cancellationToken);
        if (assignedInternIds.Contains(internId))
        {
            return true;
        }

        var hasAnyAssignment = await dbContext.Missions
            .AsNoTracking()
            .AnyAsync(mission => mission.InternId == internId || mission.InternAssignments.Any(assignment => assignment.InternId == internId), cancellationToken)
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
}
