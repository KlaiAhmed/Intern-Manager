using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Services;

/// <summary>
/// Service métier pour la supervision des journaux intern.
/// </summary>
public sealed class SupervisorJournalService(
    ISupervisorJournalRepository repository,
    ISupervisorScopeService supervisorScopeService) : ISupervisorJournalService
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<SupervisorJournalEntryResponse>> GetInternJournalAsync(
        Guid internId,
        Guid actorUserId,
        bool isAdminScope,
        CancellationToken cancellationToken)
    {
        if (!await repository.InternExistsAsync(internId, cancellationToken))
        {
            throw new KeyNotFoundException("Intern not found.");
        }

        await EnsureAccessAsync(internId, actorUserId, isAdminScope, cancellationToken);

        var entries = await repository.GetEntriesForInternAsync(internId, cancellationToken);
        return entries.Select(MapEntry).ToList();
    }

    /// <inheritdoc />
    public async Task<SupervisorJournalCommentResponse> AddCommentAsync(
        Guid entryId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        string content,
        CancellationToken cancellationToken)
    {
        var normalizedContent = content.Trim();
        if (string.IsNullOrWhiteSpace(normalizedContent))
        {
            throw new ArgumentException("content is required.");
        }

        if (normalizedContent.Length > 2000)
        {
            throw new ArgumentException("content cannot exceed 2000 characters.");
        }

        var entry = await repository.GetEntryByIdAsync(entryId, cancellationToken);
        if (entry is null)
        {
            throw new KeyNotFoundException("Journal entry not found.");
        }

        await EnsureAccessAsync(entry.InternId, actorUserId, isAdminScope, cancellationToken);

        var now = DateTime.UtcNow;
        var comment = new JournalComment
        {
            JournalEntryId = entry.Id,
            AuthorId = actorUserId,
            Content = normalizedContent,
            CreatedAt = now
        };

        repository.AddComment(comment);
        repository.AddAuditLog(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorDisplayName,
            Action = "journal.comment.create",
            Entity = $"journal:{entry.Id}",
            Timestamp = now
        });

        repository.AddInternNotification(new InternNotification
        {
            InternId = entry.InternId,
            Type = InternNotificationType.JournalCommentAdded,
            Message = "A supervisor commented on one of your journal entries.",
            RelatedEntityId = null,
            IsRead = false,
            CreatedAt = now
        });

        await repository.SaveChangesAsync(cancellationToken);

        return new SupervisorJournalCommentResponse
        {
            JournalCommentId = comment.JournalCommentId,
            AuthorId = comment.AuthorId,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt
        };
    }

    /// <inheritdoc />
    public async Task DeleteCommentAsync(
        Guid entryId,
        int commentId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        CancellationToken cancellationToken)
    {
        var entry = await repository.GetEntryByIdAsync(entryId, cancellationToken);
        if (entry is null)
        {
            throw new KeyNotFoundException("Journal entry not found.");
        }

        await EnsureAccessAsync(entry.InternId, actorUserId, isAdminScope, cancellationToken);

        var comment = await repository.GetCommentByIdAsync(commentId, cancellationToken);
        if (comment is null || comment.JournalEntryId != entryId)
        {
            throw new KeyNotFoundException("Journal comment not found.");
        }

        if (!isAdminScope && comment.AuthorId != actorUserId)
        {
            throw new UnauthorizedAccessException("Supervisor can only delete own comments.");
        }

        repository.RemoveComment(comment);
        repository.AddAuditLog(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorDisplayName,
            Action = "journal.comment.delete",
            Entity = $"journal:{entry.Id}:comment:{comment.JournalCommentId}",
            Timestamp = DateTime.UtcNow
        });

        await repository.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<SupervisorJournalEvaluationLinkResponse>> ReplaceEvaluationLinksAsync(
        Guid entryId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        IReadOnlyCollection<JournalEvaluationCriteria> criteria,
        CancellationToken cancellationToken)
    {
        var entry = await repository.GetEntryByIdAsync(entryId, cancellationToken);
        if (entry is null)
        {
            throw new KeyNotFoundException("Journal entry not found.");
        }

        await EnsureAccessAsync(entry.InternId, actorUserId, isAdminScope, cancellationToken);

        var existingLinks = await repository.GetLinksForEntryAsync(entryId, cancellationToken);
        if (existingLinks.Count > 0)
        {
            repository.RemoveLinks(existingLinks);
        }

        var now = DateTime.UtcNow;
        var deduplicatedCriteria = criteria
            .Distinct()
            .ToList();

        var links = deduplicatedCriteria.Select(item => new JournalEvaluationLink
        {
            JournalEntryId = entry.Id,
            EvaluationCriteria = item,
            LinkedByUserId = actorUserId,
            CreatedAt = now
        }).ToList();

        if (links.Count > 0)
        {
            repository.AddLinks(links);
        }

        repository.AddAuditLog(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorDisplayName,
            Action = "journal.evaluationLinks.replace",
            Entity = $"journal:{entry.Id}",
            Timestamp = now
        });

        await repository.SaveChangesAsync(cancellationToken);

        return links.Select(link => new SupervisorJournalEvaluationLinkResponse
        {
            JournalEvaluationLinkId = link.JournalEvaluationLinkId,
            Criteria = link.EvaluationCriteria,
            LinkedByUserId = link.LinkedByUserId,
            CreatedAt = link.CreatedAt
        }).ToList();
    }

    /// <inheritdoc />
    public async Task MarkReviewedAsync(
        Guid entryId,
        Guid actorUserId,
        string actorDisplayName,
        bool isAdminScope,
        CancellationToken cancellationToken)
    {
        var entry = await repository.GetEntryByIdAsync(entryId, cancellationToken);
        if (entry is null)
        {
            throw new KeyNotFoundException("Journal entry not found.");
        }

        await EnsureAccessAsync(entry.InternId, actorUserId, isAdminScope, cancellationToken);

        if (entry.IsReviewed)
        {
            return;
        }

        entry.IsReviewed = true;
        repository.UpdateEntry(entry);
        repository.AddAuditLog(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorDisplayName,
            Action = "journal.markReviewed",
            Entity = $"journal:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await repository.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureAccessAsync(
        Guid internId,
        Guid actorUserId,
        bool isAdminScope,
        CancellationToken cancellationToken)
    {
        if (isAdminScope)
        {
            return;
        }

        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(actorUserId, cancellationToken);
        if (!assignedInternIds.Contains(internId))
        {
            throw new UnauthorizedAccessException("Supervisor is not assigned to this intern.");
        }
    }

    private static SupervisorJournalEntryResponse MapEntry(JournalEntry entry)
    {
        return new SupervisorJournalEntryResponse
        {
            Id = entry.Id,
            InternId = entry.InternId,
            Content = entry.Content,
            IsReviewed = entry.IsReviewed,
            CreatedAt = entry.CreatedAt,
            Comments = entry.Comments
                .OrderByDescending(comment => comment.CreatedAt)
                .Select(comment => new SupervisorJournalCommentResponse
                {
                    JournalCommentId = comment.JournalCommentId,
                    AuthorId = comment.AuthorId,
                    Content = comment.Content,
                    CreatedAt = comment.CreatedAt
                })
                .ToList(),
            EvaluationLinks = entry.EvaluationLinks
                .OrderBy(link => link.EvaluationCriteria)
                .Select(link => new SupervisorJournalEvaluationLinkResponse
                {
                    JournalEvaluationLinkId = link.JournalEvaluationLinkId,
                    Criteria = link.EvaluationCriteria,
                    LinkedByUserId = link.LinkedByUserId,
                    CreatedAt = link.CreatedAt
                })
                .ToList()
        };
    }
}
