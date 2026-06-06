using InternManager.Api.Common.Utilities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternManager.Api.Controllers;

/// <summary>
/// Controller exposing intern-safe read-only access to mission documents
/// for the intern currently assigned to the mission.
/// </summary>
[ApiController]
[Route("api/intern/me/missions/{missionId:guid}/documents")]
[Authorize(Roles = "SuperAdmin,Admin,Intern")]
public sealed class InternMissionDocumentsController(
    IInternMissionDocumentsService internMissionDocumentsService,
    ILogger<InternMissionDocumentsController> logger) : ControllerBase
{
    /// <summary>
    /// Returns the documents attached to the intern's assigned mission, newest first.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The documents attached to the mission.</returns>
    /// <response code="200">Documents returned successfully.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">The intern is not assigned to this mission.</response>
    /// <response code="404">Mission not found.</response>
    [HttpGet(Name = "ListMyMissionDocuments")]
    [Authorize(Roles = "Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(IReadOnlyList<DocumentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDocuments(
        Guid missionId,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var documents = await internMissionDocumentsService.GetDocumentsAsync(
                missionId,
                internId.Value,
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

    /// <summary>
    /// Streams a single mission document file. The intern must be assigned to the mission,
    /// and the document id must belong to the mission.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="documentId">Unique document identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The file payload (streamed with range support).</returns>
    /// <response code="200">File returned successfully.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">The intern is not assigned to this mission.</response>
    /// <response code="404">Mission, document, or file not found.</response>
    [HttpGet("{documentId:guid}/download", Name = "DownloadMyMissionDocument")]
    [Authorize(Roles = "Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadDocument(
        Guid missionId,
        Guid documentId,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        InternMissionDocumentDownload? payload;
        try
        {
            payload = await internMissionDocumentsService.GetDownloadAsync(
                missionId,
                documentId,
                internId.Value,
                cancellationToken);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }

        if (payload is null)
        {
            logger.LogInformation(
                "Intern {InternId} attempted to download missing mission document {DocumentId} for mission {MissionId}.",
                internId.Value,
                documentId,
                missionId);
            return NotFound(new { message = "Document file is missing or not available for download." });
        }

        return File(payload.Content, payload.ContentType, payload.FileName, enableRangeProcessing: true);
    }
}
