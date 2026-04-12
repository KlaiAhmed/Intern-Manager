using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des notifications.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Récupère les notifications de l utilisateur connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les notifications de l utilisateur. Vous pouvez filtrer
    /// pour n afficher que les notifications non lues. Les résultats sont triés
    /// par date de création, de la plus récente à la plus ancienne.
    /// </remarks>
    /// <param name="unreadOnly">Si vrai, retourne uniquement les notifications non lues.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée de notifications.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    [HttpGet(Name = "ListNotifications")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var userId = UserContextHelper.ResolveCurrentUserId(User);
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Notifications
            .AsNoTracking()
            .Where(notification => notification.UserId == userId.Value)
            .AsQueryable();

        if (unreadOnly)
        {
            query = query.Where(notification => !notification.IsRead);
        }

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderByDescending(notification => notification.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(notification => new
            {
                id = notification.Id,
                type = notification.Type,
                title = notification.Title,
                message = notification.Message,
                relatedEntity = notification.RelatedEntity,
                isRead = notification.IsRead,
                createdAt = notification.CreatedAt,
                readAt = notification.ReadAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Marque une notification comme lue.
    /// </summary>
    /// <remarks>
    /// Cette route permet de marquer une notification spécifique comme lue.
    /// Une fois marquée, la notification n apparaîtra plus dans les filtres \"non lues\".
    /// </remarks>
    /// <param name="id">Identifiant unique de la notification.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la notification mise à jour.</returns>
    /// <response code="200">Notification marquée comme lue.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Notification non trouvée.</response>
    [HttpPatch("{id:guid}/read", Name = "MarkNotificationRead")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var userId = UserContextHelper.ResolveCurrentUserId(User);
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var notification = await dbContext.Notifications
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId.Value, cancellationToken);

        if (notification is null)
        {
            return NotFound(new { message = "Notification not found." });
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(new
        {
            id = notification.Id,
            isRead = notification.IsRead,
            readAt = notification.ReadAt
        });
    }
}
