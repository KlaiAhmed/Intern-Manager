using InternManager.Api.Common.Utilities;
using InternManager.Api.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/matching")]
[Authorize]
public sealed class MatchingController : ControllerBase
{
    private const string MatchingUnavailableTitle = "Matching endpoint unavailable";
    private const string MatchingUnavailableDetail = "The matching engine is not implemented yet in this environment.";

    [HttpPost("recommendations", Name = "GetMatchingRecommendations")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status501NotImplemented)]
    public IActionResult GetRecommendations([FromBody] MatchingRequest request)
    {
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

    [HttpGet("results/{internId:guid}", Name = "GetMatchingResults")]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status501NotImplemented)]
    public IActionResult GetResults(Guid internId)
    {
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
}
