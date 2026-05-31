using System.Data;
using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Jobs;

public sealed class NotificationWorker(
    IServiceScopeFactory serviceScopeFactory,
    ILogger<NotificationWorker> logger) : IHostedService, IDisposable
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    private CancellationTokenSource? cancellationTokenSource;
    private PeriodicTimer? timer;
    private Task? backgroundTask;
    private bool disposed;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timer = new PeriodicTimer(Interval);
        backgroundTask = RunLoopAsync(cancellationTokenSource.Token);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (cancellationTokenSource is null)
        {
            return;
        }

        try
        {
            cancellationTokenSource.Cancel();
        }
        catch (ObjectDisposedException)
        {
        }

        if (backgroundTask is not null)
        {
            await Task.WhenAny(backgroundTask, Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken));
        }
    }

    public Task RunOnceAsync(CancellationToken cancellationToken = default)
    {
        return ExecuteCycleAsync(cancellationToken);
    }

    private async Task RunLoopAsync(CancellationToken cancellationToken)
    {
        try
        {
            await ExecuteCycleAsync(cancellationToken);

            while (timer is not null && await timer.WaitForNextTickAsync(cancellationToken))
            {
                await ExecuteCycleAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Notification worker loop failed.");
        }
    }

    private async Task ExecuteCycleAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var now = DateTime.UtcNow;

        await ProcessOverdueTasksAsync(dbContext, notificationService, now, cancellationToken);
        await ProcessOverdueDeliverablesAsync(dbContext, notificationService, now, cancellationToken);
        await ProcessDeadlineApproachingMissionsAsync(dbContext, notificationService, now, cancellationToken);
    }

    private async Task ProcessOverdueTasksAsync(
        AppDbContext dbContext,
        INotificationService notificationService,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var candidateIds = await dbContext.InternTasks
            .AsNoTracking()
            .Where(task =>
                task.DueDate.HasValue &&
                task.DueDate.Value < now &&
                task.OverdueNotifiedAt == null &&
                task.Status != DomainStatuses.Task.Done &&
                task.Status != DomainStatuses.Task.Cancelled &&
                task.DeliverableId.HasValue)
            .Select(task => task.Id)
            .ToListAsync(cancellationToken);

        foreach (var taskId in candidateIds)
        {
            await TryProcessTaskOverdueAsync(dbContext, notificationService, taskId, now, cancellationToken);
        }
    }

    private async Task ProcessOverdueDeliverablesAsync(
        AppDbContext dbContext,
        INotificationService notificationService,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var candidateIds = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable =>
                deliverable.DueDate.HasValue &&
                deliverable.DueDate.Value < now &&
                deliverable.OverdueNotifiedAt == null &&
                deliverable.Status != DomainStatuses.Deliverable.Approved &&
                deliverable.Status != DomainStatuses.Deliverable.Accepted &&
                deliverable.Status != DomainStatuses.Deliverable.Rejected &&
                deliverable.Status != DomainStatuses.Deliverable.Cancelled)
            .Select(deliverable => deliverable.Id)
            .ToListAsync(cancellationToken);

        foreach (var deliverableId in candidateIds)
        {
            await TryProcessDeliverableOverdueAsync(dbContext, notificationService, deliverableId, now, cancellationToken);
        }
    }

    private async Task ProcessDeadlineApproachingMissionsAsync(
        AppDbContext dbContext,
        INotificationService notificationService,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var targetDate = now.Date.AddDays(7);
        var candidateIds = await dbContext.Missions
            .AsNoTracking()
            .Where(mission =>
                mission.EndDate.HasValue &&
                mission.EndDate.Value.Date == targetDate &&
                string.Equals(mission.Status, DomainStatuses.Mission.Active, StringComparison.OrdinalIgnoreCase) &&
                mission.DeadlineNotifiedAt == null)
            .Select(mission => mission.Id)
            .ToListAsync(cancellationToken);

        foreach (var missionId in candidateIds)
        {
            await TryProcessMissionDeadlineAsync(dbContext, notificationService, missionId, now, cancellationToken);
        }
    }

    private async Task<bool> TryProcessTaskOverdueAsync(
        AppDbContext dbContext,
        INotificationService notificationService,
        Guid taskId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction = null;

        try
        {
            if (dbContext.Database.IsRelational())
            {
                transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            }

            var task = await dbContext.InternTasks
                .Include(item => item.Deliverable)
                    .ThenInclude(deliverable => deliverable!.Mission)
                .FirstOrDefaultAsync(item => item.Id == taskId, cancellationToken);

            if (task is null ||
                task.OverdueNotifiedAt.HasValue ||
                !task.DueDate.HasValue ||
                task.DueDate.Value >= now ||
                task.Status == DomainStatuses.Task.Done ||
                task.Status == DomainStatuses.Task.Cancelled ||
                task.Deliverable?.Mission is null ||
                !IsActiveMission(task.Deliverable.Mission))
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                }

                return false;
            }

            task.OverdueNotifiedAt = now;
            QueueTaskOverdueNotifications(notificationService, task, now);

            await dbContext.SaveChangesAsync(cancellationToken);

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return true;
        }
        catch (DbUpdateException exception)
        {
            logger.LogDebug(exception, "Skipping duplicate overdue task notification for task {TaskId}.", taskId);

            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return false;
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private async Task<bool> TryProcessDeliverableOverdueAsync(
        AppDbContext dbContext,
        INotificationService notificationService,
        Guid deliverableId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction = null;

        try
        {
            if (dbContext.Database.IsRelational())
            {
                transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            }

            var deliverable = await dbContext.Deliverables
                .Include(item => item.Mission)
                .FirstOrDefaultAsync(item => item.Id == deliverableId, cancellationToken);

            if (deliverable is null ||
                deliverable.OverdueNotifiedAt.HasValue ||
                !deliverable.DueDate.HasValue ||
                deliverable.DueDate.Value >= now ||
                deliverable.Status == DomainStatuses.Deliverable.Approved ||
                deliverable.Status == DomainStatuses.Deliverable.Accepted ||
                deliverable.Status == DomainStatuses.Deliverable.Rejected ||
                deliverable.Status == DomainStatuses.Deliverable.Cancelled ||
                deliverable.Mission is null ||
                !IsActiveMission(deliverable.Mission))
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                }

                return false;
            }

            deliverable.OverdueNotifiedAt = now;
            QueueDeliverableOverdueNotifications(notificationService, deliverable, now);

            await dbContext.SaveChangesAsync(cancellationToken);

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return true;
        }
        catch (DbUpdateException exception)
        {
            logger.LogDebug(exception, "Skipping duplicate overdue deliverable notification for deliverable {DeliverableId}.", deliverableId);

            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return false;
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private async Task<bool> TryProcessMissionDeadlineAsync(
        AppDbContext dbContext,
        INotificationService notificationService,
        Guid missionId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction = null;

        try
        {
            if (dbContext.Database.IsRelational())
            {
                transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            }

            var mission = await dbContext.Missions
                .FirstOrDefaultAsync(item => item.Id == missionId, cancellationToken);

            if (mission is null ||
                mission.DeadlineNotifiedAt.HasValue ||
                !mission.EndDate.HasValue ||
                mission.EndDate.Value.Date != now.Date.AddDays(7) ||
                !IsActiveMission(mission))
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                }

                return false;
            }

            mission.DeadlineNotifiedAt = now;
            QueueMissionDeadlineNotifications(notificationService, mission, now);

            await dbContext.SaveChangesAsync(cancellationToken);

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return true;
        }
        catch (DbUpdateException exception)
        {
            logger.LogDebug(exception, "Skipping duplicate deadline notification for mission {MissionId}.", missionId);

            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return false;
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private static void QueueTaskOverdueNotifications(INotificationService notificationService, InternTask task, DateTime now)
    {
        if (task.InternId != Guid.Empty)
        {
            notificationService.QueueNotification(
                task.InternId,
                "task.overdue",
                "Task overdue",
                $"Task '{task.Title}' is overdue.",
                task.Id.ToString());
        }

        if (task.Deliverable?.Mission?.SupervisorId is Guid supervisorId)
        {
            notificationService.QueueNotification(
                supervisorId,
                "task.overdue",
                "Task overdue",
                $"Task '{task.Title}' assigned to your mission is overdue.",
                task.Id.ToString());
        }
    }

    private static void QueueDeliverableOverdueNotifications(INotificationService notificationService, Deliverable deliverable, DateTime now)
    {
        if (deliverable.InternId.HasValue)
        {
            notificationService.QueueNotification(
                deliverable.InternId.Value,
                "deliverable.overdue",
                "Deliverable overdue",
                $"Deliverable '{deliverable.Title}' is overdue.",
                deliverable.Id.ToString());
        }

        if (deliverable.Mission?.SupervisorId is Guid supervisorId)
        {
            notificationService.QueueNotification(
                supervisorId,
                "deliverable.overdue",
                "Deliverable overdue",
                $"Deliverable '{deliverable.Title}' assigned to your mission is overdue.",
                deliverable.Id.ToString());
        }
    }

    private static void QueueMissionDeadlineNotifications(INotificationService notificationService, Mission mission, DateTime now)
    {
        if (mission.InternId.HasValue)
        {
            notificationService.QueueNotification(
                mission.InternId.Value,
                "mission.deadline_approaching",
                "Mission ends in 7 days",
                "Your mission ends in 7 days.",
                mission.Id.ToString());
        }

        notificationService.QueueNotification(
            mission.SupervisorId,
            "mission.deadline_approaching",
            "Mission ends in 7 days",
            "Your mission ends in 7 days.",
            mission.Id.ToString());
    }

    private static bool IsActiveMission(Mission mission)
    {
        return string.Equals(mission.Status, DomainStatuses.Mission.Active, StringComparison.OrdinalIgnoreCase);
    }

    public void Dispose()
    {
        if (disposed)
        {
            return;
        }

        disposed = true;
        timer?.Dispose();
        cancellationTokenSource?.Dispose();
    }
}
