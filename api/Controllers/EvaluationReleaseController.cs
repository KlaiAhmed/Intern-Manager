using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur dédié à la publication des évaluations côté intern.
/// </summary>
[ApiController]
[Route("api/evaluation-release")]
[Authorize]
public sealed class EvaluationReleaseController(
    AppDbContext dbContext,
    IEvaluationReleaseService evaluationReleaseService,
    IMissionPolicyService missionPolicyService) : ControllerBase
{
    /// <summary>
    /// Publie une évaluation pour l intern.
    /// </summary>
    [HttpPost("{id:guid}/release")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Release(Guid id, CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");

        if (!isAdminScope)
        {
            var evaluation = await dbContext.Evaluations
                .AsNoTracking()
                .Include(item => item.Deliverable)
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (evaluation is null)
            {
                return NotFound(new { message = "Evaluation not found." });
            }

            var mission = await ResolveMissionForEvaluationAsync(actorUserId.Value, evaluation.InternId, cancellationToken);
            if (evaluation.DeliverableId.HasValue && mission is null)
            {
                mission = await dbContext.Deliverables
                    .AsNoTracking()
                    .Where(deliverable => deliverable.Id == evaluation.DeliverableId.Value)
                    .Select(deliverable => new Mission { Id = deliverable.MissionId })
                    .FirstOrDefaultAsync(cancellationToken);
            }

            if (mission is null)
            {
                return Forbid();
            }

            await missionPolicyService.CanEvaluateAsync(
                actorUserId.Value,
                UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
                mission.Id);

            await missionPolicyService.AssertMissionNotArchivedAsync(mission.Id);
        }

        try
        {
            var response = await evaluationReleaseService.ReleaseAsync(
                id,
                actorUserId.Value,
                UserContextHelper.ResolveCurrentActorName(User),
                isAdminScope,
                cancellationToken);

            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Evaluation not found." });
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    private async Task<Mission?> ResolveMissionForEvaluationAsync(Guid actorUserId, Guid internId, CancellationToken cancellationToken)
    {
        return await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.InternId == internId &&
                              (mission.SupervisorId == actorUserId || mission.CoSupervisorId == actorUserId))
            .OrderByDescending(mission => mission.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// Retire la publication d une évaluation.
    /// </summary>
    [HttpPost("{id:guid}/unrelease")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unrelease(Guid id, CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var response = await evaluationReleaseService.UnreleaseAsync(
                id,
                actorUserId.Value,
                UserContextHelper.ResolveCurrentActorName(User),
                cancellationToken);

            return Ok(response);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Evaluation not found." });
        }
    }
}
