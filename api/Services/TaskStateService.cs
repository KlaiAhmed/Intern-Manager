using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Exceptions;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class TaskStateService(
    IDeliverableProgressService deliverableProgressService,
    INotificationService notificationService) : ITaskStateService
{
    public async Task MarkDoneAsync(
        Guid taskId,
        Guid actorId,
        int expectedRowVersion,
        bool isSupervisorOverride,
        AppDbContext db)
    {
        var task = await LoadTaskAsync(taskId, db);

        if (task.Deliverable is not null && IsApprovedStatus(task.Deliverable.Status))
        {
            throw new DeliverableLockedException("This deliverable is approved. Reopen it before modifying tasks.");
        }

        if (IsStatus(task.Status, DomainStatuses.Task.Done))
        {
            return;
        }

        EnsureExpectedRowVersion(task, expectedRowVersion);

        var now = DateTime.UtcNow;
        task.Status = DomainStatuses.Task.Done;
        task.CompletedAt = now;
        task.StatusChangedAt = now;
        task.RowVersion += 1;

        AddHistory(
            db,
            "Task",
            taskId,
            isSupervisorOverride ? "task.supervisor_override" : "task.completed",
            actorId,
            isSupervisorOverride ? "Supervisor override" : null,
            now);

        if (task.Deliverable?.Mission?.SupervisorId is Guid supervisorId)
        {
            notificationService.QueueNotification(
                supervisorId,
                "task.completed",
                "Task completed",
                $"Task '{task.Title}' has been completed.",
                task.Id.ToString());
        }

        if (task.DeliverableId.HasValue)
        {
            await deliverableProgressService.RecalculateAsync(task.DeliverableId.Value, db);
        }
    }

    public async Task RevertToTodoAsync(
        Guid taskId,
        Guid actorId,
        int expectedRowVersion,
        AppDbContext db)
    {
        var task = await LoadTaskAsync(taskId, db);

        if (task.Deliverable is not null && !IsStatus(task.Deliverable.Status, DomainStatuses.Deliverable.InProgress))
        {
            throw new InvalidOperationException("Tasks can only be reverted while the deliverable is in progress.");
        }

        if (IsStatus(task.Status, DomainStatuses.Task.Todo))
        {
            return;
        }

        EnsureExpectedRowVersion(task, expectedRowVersion);

        var now = DateTime.UtcNow;
        task.Status = DomainStatuses.Task.Todo;
        task.CompletedAt = null;
        task.StatusChangedAt = now;
        task.RowVersion += 1;

        AddHistory(db, "Task", taskId, "task.reverted", actorId, null, now);

        if (task.DeliverableId.HasValue)
        {
            await deliverableProgressService.RecalculateAsync(task.DeliverableId.Value, db);
        }
    }

    public async Task ReopenAsync(
        Guid taskId,
        Guid actorId,
        int expectedRowVersion,
        string reason,
        AppDbContext db)
    {
        var normalizedReason = NormalizeReason(reason, minLength: 10);
        var task = await LoadTaskAsync(taskId, db);
        EnsureExpectedRowVersion(task, expectedRowVersion);

        var now = DateTime.UtcNow;
        task.Status = DomainStatuses.Task.Reopened;
        task.CompletedAt = null;
        task.StatusChangedAt = now;
        task.RowVersion += 1;

        AddHistory(db, "Task", taskId, "task.reopened", actorId, normalizedReason, now);

        if (task.InternId != Guid.Empty)
        {
            notificationService.QueueNotification(
                task.InternId,
                "task.reopened",
                "Task reopened",
                $"Task '{task.Title}' was reopened: {normalizedReason}",
                task.Id.ToString());
        }

        if (task.DeliverableId.HasValue)
        {
            await deliverableProgressService.RecalculateAsync(task.DeliverableId.Value, db);
        }
    }

    private static async Task<InternTask> LoadTaskAsync(Guid taskId, AppDbContext db)
    {
        var task = await db.InternTasks
            .Include(item => item.Deliverable)
                .ThenInclude(deliverable => deliverable!.Mission)
            .FirstOrDefaultAsync(item => item.Id == taskId);

        return task ?? throw new KeyNotFoundException("Task not found.");
    }

    private static void EnsureExpectedRowVersion(InternTask task, int expectedRowVersion)
    {
        if (task.RowVersion != expectedRowVersion)
        {
            throw new ConcurrencyException("Task was modified by another request. Refresh and try again.");
        }
    }

    private static string NormalizeReason(string reason, int minLength)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException($"Reason must be at least {minLength} characters long.", nameof(reason));
        }

        var normalizedReason = reason.Trim();
        if (normalizedReason.Length < minLength)
        {
            throw new ArgumentException($"Reason must be at least {minLength} characters long.", nameof(reason));
        }

        return normalizedReason;
    }

    private static void AddHistory(
        AppDbContext db,
        string entityType,
        Guid entityId,
        string action,
        Guid actorId,
        string? note,
        DateTime now)
    {
        db.EntityHistoryEntries.Add(new EntityHistoryEntry
        {
            Id = Guid.NewGuid(),
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            ActorId = actorId,
            Note = note,
            CreatedAt = now
        });
    }

    private static bool IsApprovedStatus(string status)
    {
        return IsStatus(status, DomainStatuses.Deliverable.Approved) ||
               IsStatus(status, DomainStatuses.Deliverable.Accepted);
    }

    private static bool IsStatus(string status, string expected)
    {
        return string.Equals(status, expected, StringComparison.OrdinalIgnoreCase);
    }
}
