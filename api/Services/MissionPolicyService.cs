using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Exceptions;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class MissionPolicyService(AppDbContext dbContext) : IMissionPolicyService
{
    public async Task CanViewMissionAsync(Guid actorId, string actorRole, Guid missionId)
    {
        if (HasAdminBypass(actorRole))
        {
            return;
        }

        if (IsRole(actorRole, UserRole.Manager))
        {
            return;
        }

        var mission = await ResolveMissionAsync(missionId, CancellationToken.None);

        if (mission.InternId == actorId || mission.SupervisorId == actorId || mission.CoSupervisorId == actorId)
        {
            return;
        }

        throw new ForbiddenException("You do not have access to this mission.");
    }

    public async Task CanReviewDeliverableAsync(Guid actorId, string actorRole, Guid missionId)
    {
        if (HasAdminBypass(actorRole))
        {
            return;
        }

        var mission = await ResolveMissionAsync(missionId, CancellationToken.None);

        if (mission.SupervisorId == actorId ||
            (mission.CoSupervisorId == actorId && mission.CoSupervisorCanReview))
        {
            return;
        }

        throw new ForbiddenException("You do not have permission to review this deliverable.");
    }

    public async Task CanEvaluateAsync(Guid actorId, string actorRole, Guid missionId)
    {
        if (HasAdminBypass(actorRole))
        {
            return;
        }

        var mission = await ResolveMissionAsync(missionId, CancellationToken.None);

        if (mission.SupervisorId == actorId ||
            (mission.CoSupervisorId == actorId && mission.CoSupervisorCanEval))
        {
            return;
        }

        throw new ForbiddenException("You do not have permission to evaluate this mission.");
    }

    public async Task CanCreateTaskAsync(Guid actorId, string actorRole, Guid missionId)
    {
        if (HasAdminBypass(actorRole) || IsRole(actorRole, UserRole.Manager))
        {
            return;
        }

        var mission = await ResolveMissionAsync(missionId, CancellationToken.None);

        if (mission.SupervisorId == actorId)
        {
            return;
        }

        throw new ForbiddenException("You do not have permission to create a task for this mission.");
    }

    public async Task CanSubmitEvidenceAsync(Guid actorId, string actorRole, Guid missionId, CancellationToken cancellationToken = default)
    {
        if (HasAdminBypass(actorRole))
        {
            return;
        }

        var mission = await ResolveMissionAsync(missionId, cancellationToken);

        var isAssigned = mission.InternId == actorId ||
            await dbContext.MissionInternAssignments
                .AsNoTracking()
                .AnyAsync(
                    assignment => assignment.MissionId == missionId && assignment.InternId == actorId,
                    cancellationToken);

        if (isAssigned)
        {
            return;
        }

        throw new ForbiddenException("You do not have permission to submit evidence for this mission.");
    }

    public async Task CanMarkTaskDoneAsync(Guid actorId, string actorRole, Guid taskId, bool isSupervisorOverride = false)
    {
        if (HasAdminBypass(actorRole))
        {
            return;
        }

        var task = await dbContext.InternTasks
            .AsNoTracking()
            .Include(item => item.Deliverable)
                .ThenInclude(deliverable => deliverable!.Mission)
            .FirstOrDefaultAsync(item => item.Id == taskId);

        if (task is null)
        {
            throw new NotFoundException("Task not found.");
        }

        if (task.InternId == actorId)
        {
            return;
        }

        if (isSupervisorOverride && task.Deliverable?.Mission is Mission mission && mission.SupervisorId == actorId)
        {
            return;
        }

        throw new ForbiddenException("You do not have permission to mark this task as done.");
    }

    public async Task AssertMissionNotArchivedAsync(Guid missionId)
    {
        var mission = await ResolveMissionAsync(missionId, CancellationToken.None);

        if (string.Equals(mission.Status, DomainStatuses.Mission.Archived, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("This mission is archived and cannot be modified.");
        }
    }

    private async Task<Mission> ResolveMissionAsync(Guid missionId, CancellationToken cancellationToken)
    {
        var mission = await dbContext.Missions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == missionId, cancellationToken);

        if (mission is null)
        {
            throw new NotFoundException("Mission not found.");
        }

        return mission;
    }

    private static bool HasAdminBypass(string actorRole)
    {
        return IsRole(actorRole, UserRole.Admin) || IsRole(actorRole, UserRole.SuperAdmin);
    }

    private static bool IsRole(string actorRole, UserRole expectedRole)
    {
        return string.Equals(actorRole, expectedRole.ToString(), StringComparison.OrdinalIgnoreCase);
    }
}