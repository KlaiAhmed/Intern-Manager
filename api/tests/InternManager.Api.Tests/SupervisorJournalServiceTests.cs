using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Tests;

public sealed class SupervisorJournalServiceTests
{
    [Fact]
    public async Task GetInternJournalAsync_RequiresInternAndSupervisorScope()
    {
        var internId = Guid.NewGuid();
        var repository = new FakeRepository { InternExists = false };
        var service = new SupervisorJournalService(repository, new FakeSupervisorScopeService(new HashSet<Guid>()));

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.GetInternJournalAsync(internId, Guid.NewGuid(), isAdminScope: false, CancellationToken.None));

        repository.InternExists = true;

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.GetInternJournalAsync(internId, Guid.NewGuid(), isAdminScope: false, CancellationToken.None));
    }

    [Fact]
    public async Task GetInternJournalAsync_ReturnsOrderedCommentsAndEvaluationLinks()
    {
        var internId = Guid.NewGuid();
        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            InternId = internId,
            Content = "Today I finished the dashboard.",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            IsReviewed = false,
            Comments =
            [
                new JournalComment { JournalCommentId = 1, Content = "Older", CreatedAt = DateTime.UtcNow.AddHours(-3), AuthorId = Guid.NewGuid() },
                new JournalComment { JournalCommentId = 2, Content = "Newest", CreatedAt = DateTime.UtcNow.AddHours(-1), AuthorId = Guid.NewGuid() }
            ],
            EvaluationLinks =
            [
                new JournalEvaluationLink { JournalEvaluationLinkId = 1, EvaluationCriteria = JournalEvaluationCriteria.Communication, LinkedByUserId = Guid.NewGuid(), CreatedAt = DateTime.UtcNow },
                new JournalEvaluationLink { JournalEvaluationLinkId = 2, EvaluationCriteria = JournalEvaluationCriteria.Autonomy, LinkedByUserId = Guid.NewGuid(), CreatedAt = DateTime.UtcNow }
            ]
        };
        var repository = new FakeRepository
        {
            InternExists = true,
            Entries = [entry]
        };
        var service = new SupervisorJournalService(repository, new FakeSupervisorScopeService(new HashSet<Guid> { internId }));

        var result = await service.GetInternJournalAsync(internId, Guid.NewGuid(), isAdminScope: false, CancellationToken.None);

        var response = Assert.Single(result);
        Assert.Equal("Newest", response.Comments[0].Content);
        Assert.Equal(JournalEvaluationCriteria.Autonomy, response.EvaluationLinks[0].Criteria);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task AddCommentAsync_RejectsBlankContent(string content)
    {
        var service = new SupervisorJournalService(new FakeRepository(), new FakeSupervisorScopeService(new HashSet<Guid>()));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.AddCommentAsync(Guid.NewGuid(), Guid.NewGuid(), "actor", true, content, CancellationToken.None));
    }

    [Fact]
    public async Task AddCommentAsync_CreatesTrimmedCommentAuditAndNotification()
    {
        var internId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var entry = new JournalEntry { Id = Guid.NewGuid(), InternId = internId, Content = "Entry" };
        var repository = new FakeRepository
        {
            Entry = entry
        };
        var service = new SupervisorJournalService(repository, new FakeSupervisorScopeService(new HashSet<Guid> { internId }));

        var result = await service.AddCommentAsync(entry.Id, actorId, "supervisor@example.com", false, "  Nice work.  ", CancellationToken.None);

        Assert.Equal(actorId, result.AuthorId);
        Assert.Equal("Nice work.", result.Content);
        Assert.Single(repository.AddedComments);
        Assert.Contains(repository.AuditLogs, log => log.Action == "journal.comment.create");
        Assert.Contains(repository.InternNotifications, notification => notification.InternId == internId && notification.Type == InternNotificationType.JournalCommentAdded);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task DeleteCommentAsync_RequiresExistingEntryCommentAndOwnCommentForSupervisor()
    {
        var internId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var entry = new JournalEntry { Id = Guid.NewGuid(), InternId = internId, Content = "Entry" };
        var comment = new JournalComment
        {
            JournalCommentId = 7,
            JournalEntryId = entry.Id,
            AuthorId = ownerId,
            Content = "Comment"
        };
        var repository = new FakeRepository { Entry = entry, Comment = comment };
        var service = new SupervisorJournalService(repository, new FakeSupervisorScopeService(new HashSet<Guid> { internId }));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.DeleteCommentAsync(entry.Id, comment.JournalCommentId, otherSupervisorId, "other", false, CancellationToken.None));

        await service.DeleteCommentAsync(entry.Id, comment.JournalCommentId, ownerId, "owner", false, CancellationToken.None);

        Assert.Contains(comment, repository.RemovedComments);
        Assert.Contains(repository.AuditLogs, log => log.Action == "journal.comment.delete");
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    [Fact]
    public async Task ReplaceEvaluationLinksAsync_DeduplicatesCriteriaAndReplacesExistingLinks()
    {
        var internId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var entry = new JournalEntry { Id = Guid.NewGuid(), InternId = internId, Content = "Entry" };
        var existing = new JournalEvaluationLink { JournalEvaluationLinkId = 1, JournalEntryId = entry.Id, EvaluationCriteria = JournalEvaluationCriteria.Technical };
        var repository = new FakeRepository
        {
            Entry = entry,
            ExistingLinks = [existing]
        };
        var service = new SupervisorJournalService(repository, new FakeSupervisorScopeService(new HashSet<Guid> { internId }));

        var result = await service.ReplaceEvaluationLinksAsync(
            entry.Id,
            actorId,
            "supervisor",
            false,
            [JournalEvaluationCriteria.Technical, JournalEvaluationCriteria.Technical, JournalEvaluationCriteria.Communication],
            CancellationToken.None);

        Assert.Contains(existing, repository.RemovedLinks);
        Assert.Equal(2, repository.AddedLinks.Count);
        Assert.Equal(2, result.Count);
        Assert.Contains(repository.AuditLogs, log => log.Action == "journal.evaluationLinks.replace");
    }

    [Fact]
    public async Task MarkReviewedAsync_IsIdempotentAndAuditsFirstReview()
    {
        var internId = Guid.NewGuid();
        var entry = new JournalEntry { Id = Guid.NewGuid(), InternId = internId, Content = "Entry", IsReviewed = false };
        var repository = new FakeRepository { Entry = entry };
        var service = new SupervisorJournalService(repository, new FakeSupervisorScopeService(new HashSet<Guid> { internId }));

        await service.MarkReviewedAsync(entry.Id, Guid.NewGuid(), "supervisor", false, CancellationToken.None);
        await service.MarkReviewedAsync(entry.Id, Guid.NewGuid(), "supervisor", false, CancellationToken.None);

        Assert.True(entry.IsReviewed);
        Assert.Equal(1, repository.UpdateEntryCalls);
        Assert.Single(repository.AuditLogs);
        Assert.Equal(1, repository.SaveChangesCalls);
    }

    private sealed class FakeRepository : ISupervisorJournalRepository
    {
        public bool InternExists { get; set; } = true;

        public IReadOnlyList<JournalEntry> Entries { get; init; } = [];

        public JournalEntry? Entry { get; init; }

        public JournalComment? Comment { get; init; }

        public IReadOnlyList<JournalEvaluationLink> ExistingLinks { get; init; } = [];

        public List<JournalComment> AddedComments { get; } = [];

        public List<JournalComment> RemovedComments { get; } = [];

        public List<JournalEvaluationLink> RemovedLinks { get; } = [];

        public List<JournalEvaluationLink> AddedLinks { get; } = [];

        public List<AuditLog> AuditLogs { get; } = [];

        public List<InternNotification> InternNotifications { get; } = [];

        public int SaveChangesCalls { get; private set; }

        public int UpdateEntryCalls { get; private set; }

        public Task<bool> InternExistsAsync(Guid internId, CancellationToken cancellationToken)
        {
            return Task.FromResult(InternExists);
        }

        public Task<IReadOnlyList<JournalEntry>> GetEntriesForInternAsync(Guid internId, CancellationToken cancellationToken)
        {
            return Task.FromResult(Entries);
        }

        public Task<JournalEntry?> GetEntryByIdAsync(Guid entryId, CancellationToken cancellationToken)
        {
            var entry = Entry is not null && Entry.Id == entryId ? Entry : null;
            return Task.FromResult(entry);
        }

        public Task<JournalComment?> GetCommentByIdAsync(int commentId, CancellationToken cancellationToken)
        {
            var comment = Comment is not null && Comment.JournalCommentId == commentId ? Comment : null;
            return Task.FromResult(comment);
        }

        public Task<IReadOnlyList<JournalEvaluationLink>> GetLinksForEntryAsync(Guid entryId, CancellationToken cancellationToken)
        {
            return Task.FromResult(ExistingLinks);
        }

        public void AddComment(JournalComment comment)
        {
            AddedComments.Add(comment);
        }

        public void RemoveComment(JournalComment comment)
        {
            RemovedComments.Add(comment);
        }

        public void RemoveLinks(IEnumerable<JournalEvaluationLink> links)
        {
            RemovedLinks.AddRange(links);
        }

        public void AddLinks(IEnumerable<JournalEvaluationLink> links)
        {
            AddedLinks.AddRange(links);
        }

        public void UpdateEntry(JournalEntry entry)
        {
            UpdateEntryCalls += 1;
        }

        public void AddAuditLog(AuditLog auditLog)
        {
            AuditLogs.Add(auditLog);
        }

        public void AddInternNotification(InternNotification notification)
        {
            InternNotifications.Add(notification);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeSupervisorScopeService(IReadOnlySet<Guid> assignedInternIds) : ISupervisorScopeService
    {
        public Task<IReadOnlySet<Guid>> GetAssignedInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
        {
            return Task.FromResult(assignedInternIds);
        }
    }
}
