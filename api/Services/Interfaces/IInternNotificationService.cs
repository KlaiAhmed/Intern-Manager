using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Service métier du flux notifications intern.
/// </summary>
public interface IInternNotificationService
{
    /// <summary>
    /// Retourne une page de notifications intern.
    /// </summary>
    Task<InternNotificationPageResponse> GetPagedAsync(
        Guid internId,
        bool? isRead,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>
    /// Marque une notification comme lue.
    /// </summary>
    Task<InternNotificationResponse> MarkReadAsync(
        Guid internId,
        int notificationId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Marque toutes les notifications comme lues.
    /// </summary>
    Task<int> MarkAllReadAsync(Guid internId, CancellationToken cancellationToken);
}
