using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class DeliverablesService(
    AppDbContext dbContext,
    INotificationService notificationService) : IDeliverablesService
{
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
            .AsQueryable();

        var isPendingFilter = false;

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();

            query = normalizedStatus switch
            {
                DomainStatuses.Deliverable.Pending => ApplyPendingFilter(query),
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
                    : deliverable.FileUrl
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

    public async Task<DeliverableValidationResponse> ValidateDeliverableAsync(
        Guid supervisorId,
        Guid deliverableId,
        string? status,
        string? action,
        string? comment,
        string actorName,
        CancellationToken cancellationToken)
    {
        var normalizedStatus = NormalizeValidationStatus(status, action);
        if (normalizedStatus is null)
        {
            throw new ArgumentException("Status must be 'accepted' or 'rejected'.");
        }

        if (normalizedStatus == DomainStatuses.Deliverable.Rejected && string.IsNullOrWhiteSpace(comment))
        {
            throw new ArgumentException("A comment is required when rejecting a deliverable.");
        }

        var deliverable = await dbContext.Deliverables
            .FirstOrDefaultAsync(
                item => item.Id == deliverableId && item.SupervisorId == supervisorId,
                cancellationToken);

        if (deliverable is null)
        {
            throw new KeyNotFoundException("Deliverable not found.");
        }

        var currentStatus = deliverable.Status.Trim().ToLowerInvariant();
        if (currentStatus != DomainStatuses.Deliverable.Submitted)
        {
            throw new InvalidOperationException("Only submitted deliverables can be validated.");
        }

        var latestVersion = await dbContext.DeliverableVersions
            .Where(item => item.DeliverableId == deliverable.Id)
            .OrderByDescending(item => item.VersionNumber)
            .FirstOrDefaultAsync(cancellationToken);

        if (latestVersion is null)
        {
            throw new InvalidOperationException("No submission version was found for this deliverable.");
        }

        if (!deliverable.SubmittedDate.HasValue)
        {
            throw new InvalidOperationException("Submitted date is required before validation.");
        }

        var normalizedComment = string.IsNullOrWhiteSpace(comment)
            ? null
            : comment.Trim();

        deliverable.Status = normalizedStatus;
        deliverable.SupervisorComment = normalizedComment;

        latestVersion.Status = normalizedStatus;
        latestVersion.SupervisorComment = normalizedComment;
        latestVersion.ValidatedAt = DateTime.UtcNow;

        if (normalizedStatus == DomainStatuses.Deliverable.Accepted)
        {
            deliverable.Progress = 100;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = actorName,
            Action = "deliverable.validate",
            Entity = $"deliverable:{deliverable.Id} version:{latestVersion.VersionNumber} status:{deliverable.Status}",
            Timestamp = DateTime.UtcNow
        });

        if (deliverable.InternId.HasValue)
        {
            var title = normalizedStatus == DomainStatuses.Deliverable.Accepted ? "Deliverable accepted" : "Deliverable rejected";
            var message = normalizedStatus == DomainStatuses.Deliverable.Accepted
                ? $"Your deliverable '{deliverable.Title}' (v{latestVersion.VersionNumber}) was accepted."
                : $"Your deliverable '{deliverable.Title}' (v{latestVersion.VersionNumber}) was rejected.";

            notificationService.QueueNotification(
                deliverable.InternId.Value,
                "deliverable.validation",
                title,
                message,
                $"deliverable:{deliverable.Id}:v{latestVersion.VersionNumber}");
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new DeliverableValidationResponse
        {
            Id = deliverable.Id,
            Status = deliverable.Status
        };
    }

    private static IQueryable<Deliverable> ApplyPendingFilter(IQueryable<Deliverable> query)
    {
        return query.Where(
            deliverable =>
                deliverable.Status == DomainStatuses.Deliverable.Pending ||
                deliverable.Status == DomainStatuses.Deliverable.Submitted);
    }

    private static string? NormalizeValidationStatus(string? status, string? action)
    {
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLowerInvariant();
            return normalized is DomainStatuses.Deliverable.Accepted or DomainStatuses.Deliverable.Rejected
                ? normalized
                : null;
        }

        if (string.IsNullOrWhiteSpace(action))
        {
            return null;
        }

        var normalizedAction = action.Trim().ToLowerInvariant();
        return normalizedAction switch
        {
            "accept" or DomainStatuses.Deliverable.Accepted => DomainStatuses.Deliverable.Accepted,
            "reject" or DomainStatuses.Deliverable.Rejected => DomainStatuses.Deliverable.Rejected,
            _ => null
        };
    }
}
