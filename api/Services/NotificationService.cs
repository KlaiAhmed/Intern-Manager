using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Services;

/// <summary>
/// Default implementation for writing in-app notifications.
/// </summary>
public sealed class NotificationService(AppDbContext dbContext) : INotificationService
{
    public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
    {
        if (userId == Guid.Empty || string.IsNullOrWhiteSpace(type) || string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = type.Trim(),
            Title = title?.Trim() ?? string.Empty,
            Message = message.Trim(),
            RelatedEntity = string.IsNullOrWhiteSpace(relatedEntity) ? null : relatedEntity.Trim(),
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
    }
}
