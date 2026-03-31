namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Queues in-app notifications in the current request scope.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Adds a notification to the current unit of work.
    /// </summary>
    void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null);
}
