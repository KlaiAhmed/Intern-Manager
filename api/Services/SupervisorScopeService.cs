using InternManager.Api.Data;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class SupervisorScopeService(AppDbContext dbContext) : ISupervisorScopeService
{
    public async Task<IReadOnlySet<Guid>> GetAssignedInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var assignedInternIds = await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == supervisorId && mission.InternId.HasValue)
            .Select(mission => mission.InternId!.Value)
            .Union(
                dbContext.Deliverables
                    .AsNoTracking()
                    .Where(deliverable => deliverable.SupervisorId == supervisorId && deliverable.InternId.HasValue)
                    .Select(deliverable => deliverable.InternId!.Value))
            .Union(
                dbContext.Evaluations
                    .AsNoTracking()
                    .Where(evaluation => evaluation.SupervisorId == supervisorId)
                    .Select(evaluation => evaluation.InternId))
            .Union(
                dbContext.Meetings
                    .AsNoTracking()
                    .Where(meeting => meeting.SupervisorId == supervisorId)
                    .Select(meeting => meeting.InternId))
            .Distinct()
            .ToListAsync(cancellationToken);

        return assignedInternIds.ToHashSet();
    }
}
