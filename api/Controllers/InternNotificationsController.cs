using InternManager.Api.Common.Utilities;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur des notifications in-app du stagiaire connecté.
/// </summary>
[ApiController]
[Route("api/intern/me/notifications")]
[Authorize(Roles = "SuperAdmin,Admin,Intern")]
public sealed class InternNotificationsController(IInternNotificationService internNotificationService) : ControllerBase
{
    /// <summary>
    /// Retourne les notifications paginées de l intern connecté.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(
        [FromQuery] bool? isRead = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var result = await internNotificationService.GetPagedAsync(
            internId.Value,
            isRead,
            page,
            pageSize,
            cancellationToken);

        return Ok(result);
    }

    /// <summary>
    /// Marque une notification comme lue.
    /// </summary>
    [HttpPatch("{id:int}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkRead(int id, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var result = await internNotificationService.MarkReadAsync(internId.Value, id, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Notification not found." });
        }
    }

    /// <summary>
    /// Marque toutes les notifications comme lues.
    /// </summary>
    [HttpPatch("read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var updatedCount = await internNotificationService.MarkAllReadAsync(internId.Value, cancellationToken);
        return Ok(new { updatedCount });
    }
}
