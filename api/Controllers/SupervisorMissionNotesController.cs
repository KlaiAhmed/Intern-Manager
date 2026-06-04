using InternManager.Api.Common.Utilities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

/// <summary>
/// Controller for private supervisor notes attached to missions.
/// </summary>
[ApiController]
[Route("api/supervisor/missions/{missionId:guid}/notes")]
[Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
public sealed class SupervisorMissionNotesController(
    ISupervisorMissionNotesService supervisorMissionNotesService) : ControllerBase
{
    /// <summary>
    /// Returns all private notes for an owned mission.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The private notes for the mission, newest first.</returns>
    /// <response code="200">Notes returned successfully.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">The mission is not owned by the current supervisor.</response>
    /// <response code="404">Mission not found.</response>
    [HttpGet(Name = "ListSupervisorMissionNotes")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(IReadOnlyList<NoteResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetNotes(Guid missionId, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var notes = await supervisorMissionNotesService.GetNotesAsync(
                missionId,
                supervisorId.Value,
                cancellationToken);

            return Ok(notes);
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
    /// Creates a private note for an owned mission.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="request">Note creation payload.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The created note.</returns>
    /// <response code="201">Note created successfully.</response>
    /// <response code="400">Request body or note content is invalid.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">The mission is not owned by the current supervisor.</response>
    /// <response code="404">Mission not found.</response>
    [HttpPost(Name = "CreateSupervisorMissionNote")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(NoteResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateNote(
        Guid missionId,
        [FromBody] CreateNoteRequest? request,
        CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (request is null)
        {
            return BadRequest(new { message = "request body is required." });
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var note = await supervisorMissionNotesService.CreateNoteAsync(
                missionId,
                supervisorId.Value,
                request,
                cancellationToken);

            return Created($"/api/supervisor/missions/{missionId}/notes/{note.Id}", note);
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
    /// Deletes a private note owned by the current supervisor.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="noteId">Unique note identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>No content when the note is deleted.</returns>
    /// <response code="204">Note deleted successfully.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">The note belongs to another supervisor.</response>
    /// <response code="404">Note not found.</response>
    [HttpDelete("{noteId:guid}", Name = "DeleteSupervisorMissionNote")]
    [EnableRateLimiting("delete-operations")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteNote(
        Guid missionId,
        Guid noteId,
        CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var deleted = await supervisorMissionNotesService.DeleteNoteAsync(
                missionId,
                noteId,
                supervisorId.Value,
                cancellationToken);

            return deleted
                ? NoContent()
                : NotFound(new { message = "Note not found." });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }
}
