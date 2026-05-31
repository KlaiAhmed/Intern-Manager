using System.Collections.Concurrent;
using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Exceptions;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class DeliverablesService(
    AppDbContext dbContext,
    INotificationService notificationService,
    IDeliverableProgressService deliverableProgressService,
    IMissionProgressService missionProgressService,
    IMissionStateService missionStateService) : IDeliverablesService
{
    private const string ConcurrencyConflictMessage = "This record was modified by another request. Please refresh and try again.";
    private static readonly ConcurrentDictionary<string, byte> InFlightReviewClaims = new();

    public async Task<PagedResponse<DeliverableQueueItemResponse>> GetSupervisorDeliverablesAsync(
        Guid supervisorId,
        string? status,
        int page,
        int limit,
        CancellationToken cancellationToken)
    {
        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId)
            .Include(deliverable => deliverable.Intern)
            .Include(deliverable => deliverable.Tasks)
            .AsQueryable();

        var isPendingFilter = false;

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();

            query = normalizedStatus switch
            {
                DomainStatuses.Deliverable.Pending => ApplyPendingFilter(query),
                DomainStatuses.Deliverable.AwaitingReview => query.Where(deliverable =>
                    deliverable.Status == DomainStatuses.Deliverable.AwaitingReview ||
                    deliverable.Status == DomainStatuses.Deliverable.Submitted),
                _ => query.Where(deliverable => deliverable.Status == normalizedStatus)
            };

            isPendingFilter = normalizedStatus == DomainStatuses.Deliverable.Pending;
        }

        var total = await query.CountAsync(cancellationToken);

        var orderedQuery = isPendingFilter
            ? query
                .OrderBy(deliverable => deliverable.SubmittedDate ?? DateTime.MinValue)
                .ThenBy(deliverable => deliverable.CreatedAt)
            : query
                .OrderByDescending(deliverable => deliverable.SubmittedDate)
                .ThenByDescending(deliverable => deliverable.CreatedAt);

        var data = await orderedQuery
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(deliverable => new DeliverableQueueItemResponse
            {
                Id = deliverable.Id,
                Title = deliverable.Title,
                InternId = deliverable.InternId,
                InternName = deliverable.Intern != null
                    ? $"{deliverable.Intern.FirstName} {deliverable.Intern.LastName}".Trim()
                    : string.Empty,
                SubmittedDate = deliverable.SubmittedDate,
                DueDate = deliverable.DueDate,
                Status = deliverable.Status,
                Version = deliverable.Version,
                FileUrl = string.IsNullOrWhiteSpace(deliverable.FileUrl)
                    ? "#"
                    : deliverable.FileUrl,
                RowVersion = deliverable.RowVersion,
                RawProgress = deliverable.RawProgress,
                Tasks = deliverable.Tasks
                    .Where(task => task.Status != DomainStatuses.Task.Cancelled)
                    .OrderBy(task => task.CreatedAt)
                    .Select(task => new DeliverableQueueTaskResponse
                    {
                        Id = task.Id,
                        Title = task.Title,
                        Status = task.Status,
                        RowVersion = task.RowVersion
                    })
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return new PagedResponse<DeliverableQueueItemResponse>
        {
            Data = data,
            Total = total,
            Page = safePage,
            Limit = safeLimit
        };
    }

    public async Task<DeliverableReviewResponse> ApproveDeliverableAsync(
        Guid actorId,
        Guid deliverableId,
        int rowVersion,
        CancellationToken cancellationToken)
    {
        var deliverable = await dbContext.Deliverables
            .FirstOrDefaultAsync(item => item.Id == deliverableId, cancellationToken);

        if (deliverable is null)
        {
            throw new KeyNotFoundException("Deliverable not found.");
        }

        EnsureAwaitingReview(deliverable, "Can only approve deliverables that are awaiting review.");
        EnsureExpectedRowVersion(deliverable, rowVersion);

        var claimKey = BuildReviewClaimKey(deliverableId, rowVersion);
        if (!InFlightReviewClaims.TryAdd(claimKey, 0))
        {
            throw new ConcurrencyException(ConcurrencyConflictMessage);
        }

        try
        {
            var currentVersion = await LoadCurrentVersionAsync(deliverableId, cancellationToken);
            var now = DateTime.UtcNow;

            currentVersion.Status = DomainStatuses.DeliverableVersion.Approved;
            currentVersion.SupervisorComment = null;
            currentVersion.ValidatedAt = now;

            deliverable.Status = DomainStatuses.Deliverable.Approved;
            deliverable.SupervisorComment = null;
            deliverable.RowVersion += 1;

            await deliverableProgressService.RecalculateAsync(deliverable.Id, dbContext);

            AddHistory(dbContext, "Deliverable", deliverable.Id, "deliverable.approved", actorId, null, now);

            await missionProgressService.RecalculateAsync(deliverable.MissionId, dbContext);

            if (deliverable.InternId.HasValue)
            {
                notificationService.QueueNotification(
                    deliverable.InternId.Value,
                    "deliverable.approved",
                    "Deliverable approved",
                    $"Your deliverable '{deliverable.Title}' has been approved.",
                    deliverable.Id.ToString());
            }

            await missionStateService.CheckCompletionAsync(deliverable.MissionId, dbContext);

            return ToReviewResponse(deliverable);
        }
        finally
        {
            InFlightReviewClaims.TryRemove(claimKey, out _);
        }
    }

    public async Task<DeliverableReviewResponse> RejectDeliverableAsync(
        Guid actorId,
        Guid deliverableId,
        string reason,
        IReadOnlyCollection<Guid> taskIdsToReopen,
        int rowVersion,
        CancellationToken cancellationToken)
    {
        var normalizedReason = NormalizeRejectionReason(reason);
        var deliverable = await dbContext.Deliverables
            .Include(item => item.Tasks)
            .FirstOrDefaultAsync(item => item.Id == deliverableId, cancellationToken);

        if (deliverable is null)
        {
            throw new KeyNotFoundException("Deliverable not found.");
        }

        EnsureAwaitingReview(deliverable, "Can only reject deliverables that are awaiting review.");

        var tasks = deliverable.Tasks
            .Where(task => task.Status != DomainStatuses.Task.Cancelled)
            .ToArray();
        var requestedTaskIds = taskIdsToReopen
            .Where(taskId => taskId != Guid.Empty)
            .Distinct()
            .ToArray();

        if (tasks.Length > 0 && requestedTaskIds.Length == 0)
        {
            throw new InvalidOperationException("You must select at least one task to reopen when rejecting a deliverable with tasks.");
        }

        var taskIds = tasks.Select(task => task.Id).ToHashSet();
        if (requestedTaskIds.Any(taskId => !taskIds.Contains(taskId)))
        {
            throw new InvalidOperationException("One or more task IDs do not belong to this deliverable.");
        }

        EnsureExpectedRowVersion(deliverable, rowVersion);

        var claimKey = BuildReviewClaimKey(deliverableId, rowVersion);
        if (!InFlightReviewClaims.TryAdd(claimKey, 0))
        {
            throw new ConcurrencyException(ConcurrencyConflictMessage);
        }

        try
        {
            var currentVersion = await LoadCurrentVersionAsync(deliverableId, cancellationToken);
            var now = DateTime.UtcNow;

            currentVersion.Status = DomainStatuses.DeliverableVersion.Rejected;
            currentVersion.SupervisorComment = normalizedReason;
            currentVersion.ValidatedAt = now;

            foreach (var task in tasks.Where(task => requestedTaskIds.Contains(task.Id)))
            {
                task.Status = DomainStatuses.Task.Reopened;
                task.CompletedAt = null;
                task.StatusChangedAt = now;
                task.RowVersion += 1;

                AddHistory(dbContext, "Task", task.Id, "task.reopened", actorId, normalizedReason, now);
            }

            deliverable.Status = DomainStatuses.Deliverable.InProgress;
            deliverable.SupervisorComment = normalizedReason;
            deliverable.RowVersion += 1;

            AddHistory(dbContext, "Deliverable", deliverable.Id, "deliverable.rejected", actorId, normalizedReason, now);

            await deliverableProgressService.RecalculateAsync(deliverable.Id, dbContext);

            if (deliverable.InternId.HasValue)
            {
                notificationService.QueueNotification(
                    deliverable.InternId.Value,
                    "deliverable.rejected",
                    "Deliverable rejected",
                    $"Your deliverable '{deliverable.Title}' was rejected: {normalizedReason}",
                    deliverable.Id.ToString());
            }

            return ToReviewResponse(deliverable);
        }
        finally
        {
            InFlightReviewClaims.TryRemove(claimKey, out _);
        }
    }

    private static IQueryable<Deliverable> ApplyPendingFilter(IQueryable<Deliverable> query)
    {
        return query.Where(
            deliverable =>
                deliverable.Status == DomainStatuses.Deliverable.Pending ||
                deliverable.Status == DomainStatuses.Deliverable.Submitted ||
                deliverable.Status == DomainStatuses.Deliverable.AwaitingReview);
    }

    private async Task<DeliverableVersion> LoadCurrentVersionAsync(Guid deliverableId, CancellationToken cancellationToken)
    {
        var currentVersion = await dbContext.DeliverableVersions
            .Where(item => item.DeliverableId == deliverableId && item.IsCurrentVersion)
            .OrderByDescending(item => item.VersionNumber)
            .FirstOrDefaultAsync(cancellationToken);

        currentVersion ??= await dbContext.DeliverableVersions
            .Where(item => item.DeliverableId == deliverableId)
            .OrderByDescending(item => item.VersionNumber)
            .FirstOrDefaultAsync(cancellationToken);

        return currentVersion ?? throw new InvalidOperationException("No submission version was found for this deliverable.");
    }

    private static void EnsureAwaitingReview(Deliverable deliverable, string message)
    {
        if (!IsStatus(deliverable.Status, DomainStatuses.Deliverable.AwaitingReview) &&
            !IsStatus(deliverable.Status, DomainStatuses.Deliverable.Submitted))
        {
            throw new InvalidOperationException(message);
        }
    }

    private static void EnsureExpectedRowVersion(Deliverable deliverable, int expectedRowVersion)
    {
        if (deliverable.RowVersion != expectedRowVersion)
        {
            throw new ConcurrencyException(ConcurrencyConflictMessage);
        }
    }

    private static string NormalizeRejectionReason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Rejection reason must be between 10 and 1000 characters.", nameof(reason));
        }

        var normalizedReason = reason.Trim();
        if (normalizedReason.Length is < 10 or > 1000)
        {
            throw new ArgumentException("Rejection reason must be between 10 and 1000 characters.", nameof(reason));
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

    private static DeliverableReviewResponse ToReviewResponse(Deliverable deliverable)
    {
        return new DeliverableReviewResponse
        {
            Id = deliverable.Id,
            Status = deliverable.Status,
            RowVersion = deliverable.RowVersion,
            RawProgress = deliverable.RawProgress
        };
    }

    private static string BuildReviewClaimKey(Guid deliverableId, int rowVersion)
    {
        return $"{deliverableId:N}:{rowVersion}";
    }

    private static bool IsStatus(string status, string expected)
    {
        return string.Equals(status, expected, StringComparison.OrdinalIgnoreCase);
    }
}
