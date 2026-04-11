using InternManager.Api.Common.Utilities;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur dédié à la publication des évaluations côté intern.
/// </summary>
[ApiController]
[Route("api/evaluations")]
[Authorize]
public sealed class EvaluationReleaseController(IEvaluationReleaseService evaluationReleaseService) : ControllerBase
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
