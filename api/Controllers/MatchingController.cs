using InternManager.Api.Common.Utilities;
using InternManager.Api.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de matching entre stagiaires et missions.
/// </summary>
[ApiController]
[Route("api/matching")]
[Authorize]
public sealed class MatchingController(IConfiguration configuration) : ControllerBase
{
    private const string MatchingUnavailableTitle = "Matching endpoint unavailable";
    private const string MatchingUnavailableDetail = "The matching engine is not implemented yet in this environment.";

    /// <summary>
    /// Récupère les recommandations de missions pour un stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route est destinée à recommander des missions correspondant au profil
    /// du stagiaire. Le moteur de matching n est pas encore implémenté.
    /// Actuellement, cette route retourne une erreur 501 (non implémenté).
    /// </remarks>
    /// <param name="request">Objet contenant l identifiant du stagiaire.</param>
    /// <returns>Les recommandations de missions ou une erreur 501.</returns>
    /// <response code="400">Identifiant de stagiaire manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="501">Fonctionnalité non implémentée.</response>
    [HttpPost("recommendations", Name = "GetMatchingRecommendations")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status501NotImplemented)]
    public IActionResult GetRecommendations([FromBody] MatchingRequest request)
    {
        if (!IsMatchingEnabled())
        {
            return NotFound();
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        if (request.InternId == Guid.Empty)
        {
            if (User.IsInRole("Intern"))
            {
                request.InternId = currentUserId.Value;
            }
            else
            {
                return BadRequest(new { message = "internId is required." });
            }
        }

        if (User.IsInRole("Intern") && request.InternId != currentUserId.Value)
        {
            return Forbid();
        }

        return BuildNotImplementedResponse();
    }

    /// <summary>
    /// Récupère les résultats de matching pour un stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route est destinée à récupérer les résultats d un précédent matching.
    /// Le moteur de matching n est pas encore implémenté.
    /// Actuellement, cette route retourne une erreur 501 (non implémenté).
    /// </remarks>
    /// <param name="internId">Identifiant unique du stagiaire.</param>
    /// <returns>Les résultats de matching ou une erreur 501.</returns>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="501">Fonctionnalité non implémentée.</response>
    [HttpGet("results/{internId:guid}", Name = "GetMatchingResults")]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status501NotImplemented)]
    public IActionResult GetResults(Guid internId)
    {
        if (!IsMatchingEnabled())
        {
            return NotFound();
        }

        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        if (User.IsInRole("Intern") && internId != currentUserId.Value)
        {
            return Forbid();
        }

        return BuildNotImplementedResponse();
    }

    private IActionResult BuildNotImplementedResponse()
    {
        return StatusCode(StatusCodes.Status501NotImplemented, new ProblemDetails
        {
            Type = "https://httpstatuses.com/501",
            Title = MatchingUnavailableTitle,
            Detail = MatchingUnavailableDetail,
            Status = StatusCodes.Status501NotImplemented
        });
    }

    private bool IsMatchingEnabled()
    {
        return configuration.GetValue<bool>("Features:MatchingEnabled");
    }
}
