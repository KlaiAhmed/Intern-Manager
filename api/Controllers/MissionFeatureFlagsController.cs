using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des feature flags dashboard au niveau mission.
/// </summary>
[ApiController]
[Route("api/missions/{missionId:guid}/feature-flags")]
// Read/write access is granted to the mission's primary supervisor in addition
// to Admin/SuperAdmin so the supervisor dashboard's feature-flag panel works
// without requiring an admin role.
[Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
public sealed class MissionFeatureFlagsController(
    IMissionFeatureFlagsService missionFeatureFlagsService,
    AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Retourne la configuration de cartes dashboard de la mission.
    /// </summary>
    [HttpGet]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(MissionCardConfig), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid missionId, CancellationToken cancellationToken)
    {
        if (!await IsOwnerOrAdminAsync(missionId, cancellationToken))
        {
            return Forbid();
        }

        try
        {
            var config = await missionFeatureFlagsService.GetMissionConfigAsync(missionId, cancellationToken);
            return Ok(config);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Mission not found." });
        }
    }

    /// <summary>
    /// Met à jour la configuration de cartes dashboard de la mission.
    /// </summary>
    [HttpPut]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(typeof(MissionCardConfig), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Put(Guid missionId, [FromBody] MissionCardConfig request, CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        if (request is null)
        {
            return BadRequest(new { message = "Mission card config is required." });
        }

        if (!await IsOwnerOrAdminAsync(missionId, cancellationToken))
        {
            return Forbid();
        }

        try
        {
            var updated = await missionFeatureFlagsService.UpdateMissionConfigAsync(
                missionId,
                request,
                actorUserId.Value,
                UserContextHelper.ResolveCurrentActorName(User),
                cancellationToken);

            return Ok(updated);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Mission not found." });
        }
    }

    /// <summary>
    /// Retourne l historique des changements de feature flags.
    /// </summary>
    [HttpGet("history")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistory(Guid missionId, CancellationToken cancellationToken)
    {
        if (!await IsOwnerOrAdminAsync(missionId, cancellationToken))
        {
            return Forbid();
        }

        try
        {
            var history = await missionFeatureFlagsService.GetHistoryAsync(missionId, 20, cancellationToken);
            return Ok(new { data = history });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Mission not found." });
        }
    }

    private async Task<bool> IsOwnerOrAdminAsync(Guid missionId, CancellationToken cancellationToken)
    {
        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        if (isAdminScope)
        {
            return true;
        }

        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return false;
        }

        var supervisorId = await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.Id == missionId)
            .Select(mission => (Guid?)mission.SupervisorId)
            .FirstOrDefaultAsync(cancellationToken);

        return supervisorId.HasValue && supervisorId.Value == actorUserId.Value;
    }
}
