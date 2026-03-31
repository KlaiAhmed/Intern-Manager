using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet(Name = "ListNotifications")]
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

    [HttpPatch("{id:guid}/read", Name = "MarkNotificationRead")]
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
