using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Services;

/// <summary>
/// Service métier du flux notifications intern.
/// </summary>
public sealed class InternNotificationService(IInternNotificationRepository repository) : IInternNotificationService
{
    /// <inheritdoc />
    public async Task<InternNotificationPageResponse> GetPagedAsync(
        Guid internId,
        bool? isRead,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 1, 100);

        var (notifications, total) = await repository.GetPagedAsync(
            internId,
            isRead,
            safePage,
            safePageSize,
            cancellationToken);

        return new InternNotificationPageResponse
        {
            Data = notifications
                .Select(Map)
                .ToList(),
            Total = total,
            Page = safePage,
            PageSize = safePageSize
        };
    }

    /// <inheritdoc />
    public async Task<InternNotificationResponse> MarkReadAsync(
        Guid internId,
        int notificationId,
        CancellationToken cancellationToken)
    {
        var notification = await repository.GetByIdAsync(internId, notificationId, cancellationToken);
        if (notification is null)
        {
            throw new KeyNotFoundException("Notification not found.");
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await repository.SaveChangesAsync(cancellationToken);
        }

        return Map(notification);
    }

    /// <inheritdoc />
    public async Task<int> MarkAllReadAsync(Guid internId, CancellationToken cancellationToken)
    {
        var unread = await repository.GetUnreadAsync(internId, cancellationToken);
        if (unread.Count == 0)
        {
            return 0;
        }

        foreach (var notification in unread)
        {
            notification.IsRead = true;
        }

        await repository.SaveChangesAsync(cancellationToken);
        return unread.Count;
    }

    private static InternNotificationResponse Map(Models.Entities.InternNotification notification)
    {
        return new InternNotificationResponse
        {
            NotificationId = notification.NotificationId,
            Type = notification.Type.ToString(),
            Message = notification.Message,
            RelatedEntityId = notification.RelatedEntityId,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt
        };
    }
}
