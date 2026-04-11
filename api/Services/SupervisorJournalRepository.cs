using InternManager.Api.Data;
using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

/// <summary>
/// Dépôt EF Core pour les opérations de supervision du journal.
/// </summary>
public sealed class SupervisorJournalRepository(AppDbContext dbContext) : ISupervisorJournalRepository
{
    /// <inheritdoc />
    public Task<bool> InternExistsAsync(Guid internId, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == internId && user.Role == UserRole.Intern, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<JournalEntry>> GetEntriesForInternAsync(Guid internId, CancellationToken cancellationToken)
    {
        return await dbContext.JournalEntries
            .AsNoTracking()
            .Where(entry => entry.InternId == internId)
            .Include(entry => entry.Comments)
            .Include(entry => entry.EvaluationLinks)
            .OrderByDescending(entry => entry.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<JournalEntry?> GetEntryByIdAsync(Guid entryId, CancellationToken cancellationToken)
    {
        return dbContext.JournalEntries
            .Include(entry => entry.Comments)
            .Include(entry => entry.EvaluationLinks)
            .FirstOrDefaultAsync(entry => entry.Id == entryId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<JournalComment?> GetCommentByIdAsync(int commentId, CancellationToken cancellationToken)
    {
        return dbContext.JournalComments
            .FirstOrDefaultAsync(comment => comment.JournalCommentId == commentId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<JournalEvaluationLink>> GetLinksForEntryAsync(Guid entryId, CancellationToken cancellationToken)
    {
        return await dbContext.JournalEvaluationLinks
            .Where(link => link.JournalEntryId == entryId)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public void AddComment(JournalComment comment)
    {
        dbContext.JournalComments.Add(comment);
    }

    /// <inheritdoc />
    public void RemoveComment(JournalComment comment)
    {
        dbContext.JournalComments.Remove(comment);
    }

    /// <inheritdoc />
    public void RemoveLinks(IEnumerable<JournalEvaluationLink> links)
    {
        dbContext.JournalEvaluationLinks.RemoveRange(links);
    }

    /// <inheritdoc />
    public void AddLinks(IEnumerable<JournalEvaluationLink> links)
    {
        dbContext.JournalEvaluationLinks.AddRange(links);
    }

    /// <inheritdoc />
    public void UpdateEntry(JournalEntry entry)
    {
        dbContext.JournalEntries.Update(entry);
    }

    /// <inheritdoc />
    public void AddAuditLog(AuditLog auditLog)
    {
        dbContext.AuditLogs.Add(auditLog);
    }

    /// <inheritdoc />
    public void AddInternNotification(InternNotification notification)
    {
        dbContext.InternNotifications.Add(notification);
    }

    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
