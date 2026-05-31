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
            RelatedEntity = NormalizeRelatedEntity(relatedEntity),
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
    }

    private static string? NormalizeRelatedEntity(string? relatedEntity)
    {
        if (string.IsNullOrWhiteSpace(relatedEntity))
        {
            return null;
        }

        var trimmedValue = relatedEntity.Trim();
        var separatorIndex = trimmedValue.LastIndexOf(':');

        return separatorIndex >= 0 && separatorIndex < trimmedValue.Length - 1
            ? trimmedValue[(separatorIndex + 1)..].Trim()
            : trimmedValue;
    }
}
