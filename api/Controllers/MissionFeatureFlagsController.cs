using InternManager.Api.Common.Utilities;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des feature flags dashboard au niveau mission.
/// </summary>
[ApiController]
[Route("api/missions/{missionId:guid}/feature-flags")]
[Authorize(Roles = "SuperAdmin,Admin")]
public sealed class MissionFeatureFlagsController(IMissionFeatureFlagsService missionFeatureFlagsService) : ControllerBase
{
    /// <summary>
    /// Retourne la configuration de cartes dashboard de la mission.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(MissionCardConfig), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid missionId, CancellationToken cancellationToken)
    {
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
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistory(Guid missionId, CancellationToken cancellationToken)
    {
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
}
