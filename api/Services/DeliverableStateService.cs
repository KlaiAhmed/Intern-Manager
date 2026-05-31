using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class DeliverableStateService(
    IDeliverableProgressService deliverableProgressService,
    INotificationService notificationService) : IDeliverableStateService
{
    public async Task OnFirstTaskCreatedAsync(Guid deliverableId, AppDbContext db)
    {
        var deliverable = await LoadDeliverableAsync(deliverableId, db);

        if (!IsStatus(deliverable.Status, DomainStatuses.Deliverable.Draft) &&
            !IsStatus(deliverable.Status, DomainStatuses.Deliverable.Pending))
        {
            return;
        }

        var now = DateTime.UtcNow;
        deliverable.Status = DomainStatuses.Deliverable.InProgress;
        deliverable.RowVersion += 1;

        AddHistory(db, "Deliverable", deliverableId, "deliverable.started", null, null, now);

        await deliverableProgressService.RecalculateAsync(deliverableId, db);
    }

    public async Task OnTaskAddedWhileInReviewAsync(Guid deliverableId, AppDbContext db)
    {
        var deliverable = await LoadDeliverableAsync(deliverableId, db);

        if (!IsStatus(deliverable.Status, DomainStatuses.Deliverable.AwaitingReview))
        {
            return;
        }

        var now = DateTime.UtcNow;
        deliverable.Status = DomainStatuses.Deliverable.InProgress;
        deliverable.RowVersion += 1;

        AddHistory(db, "Deliverable", deliverableId, "deliverable.review_interrupted", null, null, now);

        if (deliverable.SupervisorId != Guid.Empty)
        {
            notificationService.QueueNotification(
                deliverable.SupervisorId,
                "deliverable.task_added_while_in_review",
                "Task added while deliverable is in review",
                $"A task was added to '{deliverable.Title}' while it was awaiting review.",
                deliverable.Id.ToString());
        }

        await deliverableProgressService.RecalculateAsync(deliverableId, db);
    }

    public async Task ReopenApprovedAsync(Guid deliverableId, Guid actorId, string reason, AppDbContext db)
    {
        var normalizedReason = NormalizeReason(reason, minLength: 10, maxLength: null);
        var deliverable = await LoadDeliverableAsync(deliverableId, db);

        if (!IsStatus(deliverable.Status, DomainStatuses.Deliverable.Approved))
        {
            throw new InvalidOperationException("Only approved deliverables can be reopened.");
        }

        var now = DateTime.UtcNow;
        deliverable.Status = DomainStatuses.Deliverable.InProgress;
        deliverable.RowVersion += 1;

        AddHistory(db, "Deliverable", deliverableId, "deliverable.reopened", actorId, normalizedReason, now);

        if (deliverable.InternId.HasValue)
        {
            notificationService.QueueNotification(
                deliverable.InternId.Value,
                "deliverable.reopened",
                "Deliverable reopened",
                $"Your approved deliverable '{deliverable.Title}' was reopened: {normalizedReason}",
                deliverable.Id.ToString());
        }

        await deliverableProgressService.RecalculateAsync(deliverableId, db);
    }

    private static async Task<Deliverable> LoadDeliverableAsync(Guid deliverableId, AppDbContext db)
    {
        var deliverable = await db.Deliverables
            .FirstOrDefaultAsync(item => item.Id == deliverableId);

        return deliverable ?? throw new KeyNotFoundException("Deliverable not found.");
    }

    private static string NormalizeReason(string reason, int minLength, int? maxLength)
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

        if (maxLength.HasValue && normalizedReason.Length > maxLength.Value)
        {
            throw new ArgumentException($"Reason must be {maxLength.Value} characters or fewer.", nameof(reason));
        }

        return normalizedReason;
    }

    private static void AddHistory(
        AppDbContext db,
        string entityType,
        Guid entityId,
        string action,
        Guid? actorId,
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

    private static bool IsStatus(string status, string expected)
    {
        return string.Equals(status, expected, StringComparison.OrdinalIgnoreCase);
    }
}
