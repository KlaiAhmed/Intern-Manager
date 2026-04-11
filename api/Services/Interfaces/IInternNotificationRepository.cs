using InternManager.Api.Models.Entities;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Accès aux données du flux de notifications intern.
/// </summary>
public interface IInternNotificationRepository
{
    /// <summary>
    /// Retourne la page de notifications d un intern.
    /// </summary>
    Task<(IReadOnlyList<InternNotification> Notifications, int Total)> GetPagedAsync(
        Guid internId,
        bool? isRead,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>
    /// Retourne une notification par identifiant pour un intern.
    /// </summary>
    Task<InternNotification?> GetByIdAsync(Guid internId, int notificationId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne les notifications non lues d un intern.
    /// </summary>
    Task<IReadOnlyList<InternNotification>> GetUnreadAsync(Guid internId, CancellationToken cancellationToken);

    /// <summary>
    /// Persiste les changements.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
