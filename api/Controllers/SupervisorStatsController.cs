using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/stats/supervisor/me")]
[Authorize(Roles = "Supervisor")]
public sealed class SupervisorStatsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("interns/active", Name = "GetMyActiveInterns")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorActiveInternsCount(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var supervisorInternIds = await ResolveSupervisorInternIdsAsync(supervisorId.Value, cancellationToken);
        if (supervisorInternIds.Count == 0)
        {
            return Ok(new { count = 0 });
        }

        var count = await dbContext.Users
            .AsNoTracking()
            .CountAsync(user => supervisorInternIds.Contains(user.Id) &&
                                user.Role == UserRole.Intern &&
                                user.Status == UserStatus.Active,
                        cancellationToken);

        return Ok(new { count });
    }

    [HttpGet("deliverables/pending", Name = "GetMyPendingDeliverables")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorPendingDeliverablesCount(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var count = await dbContext.Deliverables
            .AsNoTracking()
            .CountAsync(deliverable => deliverable.SupervisorId == supervisorId.Value &&
                                        (deliverable.Status == "pending" || deliverable.Status == "submitted"),
                        cancellationToken);

        return Ok(new { count });
    }

    [HttpGet("avg-progress", Name = "GetMyAvgProgress")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorAverageProgress(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var averageProgress = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId.Value)
            .Select(deliverable => (double)Math.Clamp(deliverable.Progress, 0, 100))
            .DefaultIfEmpty(0)
            .AverageAsync(cancellationToken);

        return Ok(new { value = Math.Round(averageProgress, 2) });
    }

    [HttpGet("overdue", Name = "GetMyOverdueItems")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorOverdueCount(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var utcNow = DateTime.UtcNow;
        var count = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId.Value &&
                                  deliverable.DueDate.HasValue &&
                                  deliverable.DueDate.Value < utcNow &&
                                  deliverable.Status != "accepted" &&
                                  deliverable.Status != "rejected")
            .Select(deliverable => deliverable.InternId)
            .Where(internId => internId.HasValue)
            .Select(internId => internId!.Value)
            .Distinct()
            .CountAsync(cancellationToken);

        return Ok(new { count });
    }

    private async Task<HashSet<Guid>> ResolveSupervisorInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var internIds = new HashSet<Guid>();

        internIds.UnionWith(await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == supervisorId && mission.InternId.HasValue)
            .Select(mission => mission.InternId!.Value)
            .ToListAsync(cancellationToken));

        internIds.UnionWith(await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId && deliverable.InternId.HasValue)
            .Select(deliverable => deliverable.InternId!.Value)
            .ToListAsync(cancellationToken));

        internIds.UnionWith(await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == supervisorId)
            .Select(evaluation => evaluation.InternId)
            .ToListAsync(cancellationToken));

        internIds.UnionWith(await dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.SupervisorId == supervisorId)
            .Select(meeting => meeting.InternId)
            .ToListAsync(cancellationToken));

        return internIds;
    }
}
