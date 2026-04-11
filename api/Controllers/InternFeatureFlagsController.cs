using InternManager.Api.Common.Utilities;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur read-only des feature flags applicables à l intern connecté.
/// </summary>
[ApiController]
[Route("api/intern/me/feature-flags")]
[Authorize(Roles = "SuperAdmin,Admin,Intern")]
public sealed class InternFeatureFlagsController(IMissionFeatureFlagsService missionFeatureFlagsService) : ControllerBase
{
    /// <summary>
    /// Retourne la configuration de feature flags de la mission active de l intern.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActiveMissionFeatureFlags(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var config = await missionFeatureFlagsService.GetActiveMissionConfigForInternAsync(internId.Value, cancellationToken);
        if (config is null)
        {
            return Ok(new { data = (object?)null });
        }

        return Ok(new { data = config });
    }
}
