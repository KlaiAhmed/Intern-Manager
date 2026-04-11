using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

/// <summary>
/// Dépôt EF Core du flux notifications intern.
/// </summary>
public sealed class InternNotificationRepository(AppDbContext dbContext) : IInternNotificationRepository
{
    /// <inheritdoc />
    public async Task<(IReadOnlyList<InternNotification> Notifications, int Total)> GetPagedAsync(
        Guid internId,
        bool? isRead,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 1, 100);

        var query = dbContext.InternNotifications
            .AsNoTracking()
            .Where(item => item.InternId == internId)
            .AsQueryable();

        if (isRead.HasValue)
        {
            query = query.Where(item => item.IsRead == isRead.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var data = await query
            .OrderByDescending(item => item.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(cancellationToken);

        return (data, total);
    }

    /// <inheritdoc />
    public Task<InternNotification?> GetByIdAsync(Guid internId, int notificationId, CancellationToken cancellationToken)
    {
        return dbContext.InternNotifications
            .FirstOrDefaultAsync(item => item.InternId == internId && item.NotificationId == notificationId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<InternNotification>> GetUnreadAsync(Guid internId, CancellationToken cancellationToken)
    {
        return await dbContext.InternNotifications
            .Where(item => item.InternId == internId && !item.IsRead)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
