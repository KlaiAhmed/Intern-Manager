using InternManager.Api.Common.Constants;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Tests;

public sealed class EvaluationReleaseServiceTests
{
    [Fact]
    public async Task ReleaseAsync_ThrowsWhenEvaluationIsMissingOrOutOfSupervisorScope()
    {
        var missingService = new EvaluationReleaseService(
            new FakeRepository(null),
            new FakeSupervisorScopeService(new HashSet<Guid>()));

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            missingService.ReleaseAsync(Guid.NewGuid(), Guid.NewGuid(), "actor", isAdminScope: true, CancellationToken.None));

        var evaluation = BuildEvaluation(DomainStatuses.Evaluation.Submitted);
        var scopedService = new EvaluationReleaseService(
            new FakeRepository(evaluation),
            new FakeSupervisorScopeService(new HashSet<Guid>()));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            scopedService.ReleaseAsync(evaluation.Id, Guid.NewGuid(), "supervisor", isAdminScope: false, CancellationToken.None));
    }

    [Fact]
    public async Task ReleaseAsync_RequiresSubmittedStatus()
    {
        var evaluation = BuildEvaluation(DomainStatuses.Evaluation.Pending);
        var service = new EvaluationReleaseService(
            new FakeRepository(evaluation),
            new FakeSupervisorScopeService(new HashSet<Guid> { evaluation.InternId }));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ReleaseAsync(evaluation.Id, Guid.NewGuid(), "supervisor", isAdminScope: false, CancellationToken.None));
    }

    [Fact]
    public async Task ReleaseAsync_SetsReleaseFieldsAuditsAndNotifiesIntern()
    {
        var actorId = Guid.NewGuid();
        var evaluation = BuildEvaluation(DomainStatuses.Evaluation.Submitted);
        var repository = new FakeRepository(evaluation);
        var service = new EvaluationReleaseService(
            repository,
            new FakeSupervisorScopeService(new HashSet<Guid> { evaluation.InternId }));

        var result = await service.ReleaseAsync(evaluation.Id, actorId, "supervisor@example.com", isAdminScope: false, CancellationToken.None);

        Assert.True(result.IsReleasedToIntern);
        Assert.Equal(actorId, result.ReleasedByUserId);
        Assert.NotNull(result.ReleasedAt);
        Assert.Equal(1, repository.UpdateCalls);
        Assert.Equal(1, repository.SaveChangesCalls);
        Assert.Contains(repository.AuditLogs, log => log.Action == "evaluation.release" && log.Actor == "supervisor@example.com");
        Assert.Contains(repository.InternNotifications, notification => notification.InternId == evaluation.InternId && !notification.IsRead);
    }

    [Fact]
    public async Task ReleaseAsync_IsIdempotentForAlreadyReleasedEvaluation()
    {
        var actorId = Guid.NewGuid();
        var evaluation = BuildEvaluation(DomainStatuses.Evaluation.Submitted);
        evaluation.IsReleasedToIntern = true;
        evaluation.ReleasedAt = DateTime.UtcNow.AddDays(-1);
        evaluation.ReleasedByUserId = actorId;
        var repository = new FakeRepository(evaluation);
        var service = new EvaluationReleaseService(repository, new FakeSupervisorScopeService(new HashSet<Guid>()));

        var result = await service.ReleaseAsync(evaluation.Id, actorId, "admin@example.com", isAdminScope: true, CancellationToken.None);

        Assert.True(result.IsReleasedToIntern);
        Assert.Equal(0, repository.UpdateCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
        Assert.Empty(repository.InternNotifications);
    }

    [Fact]
    public async Task UnreleaseAsync_ClearsReleaseFieldsAndAudits()
    {
        var evaluation = BuildEvaluation(DomainStatuses.Evaluation.Submitted);
        evaluation.IsReleasedToIntern = true;
        evaluation.ReleasedAt = DateTime.UtcNow;
        evaluation.ReleasedByUserId = Guid.NewGuid();
        var repository = new FakeRepository(evaluation);
        var service = new EvaluationReleaseService(repository, new FakeSupervisorScopeService(new HashSet<Guid>()));

        var result = await service.UnreleaseAsync(evaluation.Id, Guid.NewGuid(), "admin@example.com", CancellationToken.None);

        Assert.False(result.IsReleasedToIntern);
        Assert.Null(result.ReleasedAt);
        Assert.Null(result.ReleasedByUserId);
        Assert.Equal(1, repository.UpdateCalls);
        Assert.Equal(1, repository.SaveChangesCalls);
        Assert.Contains(repository.AuditLogs, log => log.Action == "evaluation.unrelease");
    }

    private static Evaluation BuildEvaluation(string status)
    {
        return new Evaluation
        {
            Id = Guid.NewGuid(),
            InternId = Guid.NewGuid(),
            SupervisorId = Guid.NewGuid(),
            Type = "mid-term",
            Status = status,
            CreatedAt = DateTime.UtcNow
        };
    }

    private sealed class FakeRepository(Evaluation? evaluation) : IEvaluationReleaseRepository
    {
        public List<AuditLog> AuditLogs { get; } = [];

        public List<InternNotification> InternNotifications { get; } = [];

        public int UpdateCalls { get; private set; }

        public int SaveChangesCalls { get; private set; }

        public Task<Evaluation?> GetByIdAsync(Guid evaluationId, CancellationToken cancellationToken)
        {
            return Task.FromResult(evaluation is not null && evaluation.Id == evaluationId ? evaluation : null);
        }

        public void Update(Evaluation evaluation)
        {
            UpdateCalls += 1;
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
