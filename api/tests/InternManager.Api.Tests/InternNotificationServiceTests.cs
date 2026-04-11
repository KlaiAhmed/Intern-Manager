using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Tests;

public sealed class InternNotificationServiceTests
{
    [Fact]
    public async Task MarkAllReadAsync_MarksUnreadNotificationsAndReturnsCount()
    {
        var internId = Guid.NewGuid();

        var notifications = new List<InternNotification>
        {
            new() { NotificationId = 1, InternId = internId, Type = InternNotificationType.FeatureFlagChanged, Message = "A", IsRead = false },
            new() { NotificationId = 2, InternId = internId, Type = InternNotificationType.EvaluationReleased, Message = "B", IsRead = false },
            new() { NotificationId = 3, InternId = internId, Type = InternNotificationType.JournalCommentAdded, Message = "C", IsRead = true },
        };

        var repository = new FakeInternNotificationRepository(notifications);
        var service = new InternNotificationService(repository);

        var updatedCount = await service.MarkAllReadAsync(internId, CancellationToken.None);

        Assert.Equal(2, updatedCount);
        Assert.All(notifications, notification => Assert.True(notification.IsRead));
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task MarkReadAsync_ThrowsWhenNotificationDoesNotExist()
    {
        var repository = new FakeInternNotificationRepository([]);
        var service = new InternNotificationService(repository);

        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
        {
            await service.MarkReadAsync(Guid.NewGuid(), 99, CancellationToken.None);
        });
    }

    private sealed class FakeInternNotificationRepository(List<InternNotification> notifications) : IInternNotificationRepository
    {
        public int SaveChangesCalls { get; private set; }

        public Task<(IReadOnlyList<InternNotification> Notifications, int Total)> GetPagedAsync(
            Guid internId,
            bool? isRead,
            int page,
            int pageSize,
            CancellationToken cancellationToken)
        {
            IEnumerable<InternNotification> query = notifications.Where(item => item.InternId == internId);

            if (isRead.HasValue)
            {
                query = query.Where(item => item.IsRead == isRead.Value);
            }

            var paged = query.Skip((Math.Max(page, 1) - 1) * Math.Clamp(pageSize, 1, 100)).Take(Math.Clamp(pageSize, 1, 100)).ToList();
            var total = query.Count();

            return Task.FromResult<(IReadOnlyList<InternNotification>, int)>((paged, total));
        }

        public Task<InternNotification?> GetByIdAsync(Guid internId, int notificationId, CancellationToken cancellationToken)
        {
            var item = notifications.FirstOrDefault(notification =>
                notification.InternId == internId && notification.NotificationId == notificationId);

            return Task.FromResult(item);
        }

        public Task<IReadOnlyList<InternNotification>> GetUnreadAsync(Guid internId, CancellationToken cancellationToken)
        {
            var unread = notifications
                .Where(item => item.InternId == internId && !item.IsRead)
                .ToList();

            return Task.FromResult<IReadOnlyList<InternNotification>>(unread);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }
    }
}
