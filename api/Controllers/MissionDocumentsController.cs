using InternManager.Api.Common.Exceptions;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

/// <summary>
/// Controller for supervisor-owned documents attached to missions.
/// </summary>
[ApiController]
[Route("api/missions/{missionId:guid}/documents")]
[Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
public sealed class MissionDocumentsController(
    IMissionDocumentsService missionDocumentsService) : ControllerBase
{
    /// <summary>
    /// Uploads a file or registers an HTTPS URL as a mission document.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="request">Multipart form with either a File or a Url, plus an optional Label.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The created mission document.</returns>
    /// <response code="201">Document created successfully.</response>
    /// <response code="400">Request payload is invalid (both file and url, neither, oversize, bad label).</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">The mission is not owned by the current supervisor.</response>
    /// <response code="404">Mission not found.</response>
    /// <response code="415">Uploaded file content type is not allowed.</response>
    [HttpPost(Name = "CreateMissionDocument")]
    [EnableRateLimiting("upload")]
    [ProducesResponseType(typeof(DocumentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    public async Task<IActionResult> UploadDocument(
        Guid missionId,
        [FromForm] UploadDocumentRequest request,
        CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var response = await missionDocumentsService.UploadDocumentAsync(
                missionId,
                supervisorId.Value,
                request,
                cancellationToken);

            return CreatedAtAction(nameof(GetDocuments), new { missionId }, response);
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (UnsupportedDocumentMediaTypeException exception)
        {
            return StatusCode(StatusCodes.Status415UnsupportedMediaType, new { message = exception.Message });
        }
    }

    /// <summary>
    /// Returns all documents attached to an owned mission, newest first.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The documents attached to the mission.</returns>
    /// <response code="200">Documents returned successfully.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">The mission is not owned by the current supervisor.</response>
    /// <response code="404">Mission not found.</response>
    [HttpGet(Name = "ListMissionDocuments")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(IReadOnlyList<DocumentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDocuments(Guid missionId, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var documents = await missionDocumentsService.GetDocumentsAsync(
                missionId,
                supervisorId.Value,
                cancellationToken);

            return Ok(documents);
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
