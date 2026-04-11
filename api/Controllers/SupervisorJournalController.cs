using InternManager.Api.Common.Utilities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de supervision du journal intern.
/// </summary>
[ApiController]
[Route("api/supervisor")]
[Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
public sealed class SupervisorJournalController(ISupervisorJournalService supervisorJournalService) : ControllerBase
{
    /// <summary>
    /// Retourne toutes les entrées de journal d un intern avec commentaires et liens critères.
    /// </summary>
    [HttpGet("interns/{internId:guid}/journal")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInternJournal(Guid internId, CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
            var data = await supervisorJournalService.GetInternJournalAsync(
                internId,
                actorUserId.Value,
                isAdminScope,
                cancellationToken);

            return Ok(new { data });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Crée un commentaire sur une entrée de journal.
    /// </summary>
    [HttpPost("journal-entries/{entryId:guid}/comments")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddComment(
        Guid entryId,
        [FromBody] SupervisorJournalCommentRequest request,
        CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        if (request is null)
        {
            return BadRequest(new { message = "request body is required." });
        }

        try
        {
            var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
            var comment = await supervisorJournalService.AddCommentAsync(
                entryId,
                actorUserId.Value,
                UserContextHelper.ResolveCurrentActorName(User),
                isAdminScope,
                request.Content,
                cancellationToken);

            return StatusCode(StatusCodes.Status201Created, comment);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Supprime un commentaire sur une entrée de journal.
    /// </summary>
    [HttpDelete("journal-entries/{entryId:guid}/comments/{commentId:int}")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteComment(Guid entryId, int commentId, CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
            await supervisorJournalService.DeleteCommentAsync(
                entryId,
                commentId,
                actorUserId.Value,
                UserContextHelper.ResolveCurrentActorName(User),
                isAdminScope,
                cancellationToken);

            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Remplace les liens critères d évaluation d une entrée.
    /// </summary>
    [HttpPost("journal-entries/{entryId:guid}/evaluation-links")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReplaceEvaluationLinks(
        Guid entryId,
        [FromBody] SupervisorJournalEvaluationLinksRequest request,
        CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        if (request is null)
        {
            return BadRequest(new { message = "request body is required." });
        }

        try
        {
            var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
            var links = await supervisorJournalService.ReplaceEvaluationLinksAsync(
                entryId,
                actorUserId.Value,
                UserContextHelper.ResolveCurrentActorName(User),
                isAdminScope,
                request.Criteria,
                cancellationToken);

            return Ok(new { data = links });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Marque une entrée de journal comme revue.
    /// </summary>
    [HttpPatch("journal-entries/{entryId:guid}/mark-reviewed")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkReviewed(Guid entryId, CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
            await supervisorJournalService.MarkReviewedAsync(
                entryId,
                actorUserId.Value,
                UserContextHelper.ResolveCurrentActorName(User),
                isAdminScope,
                cancellationToken);

            return Ok(new { success = true });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
    }
}
