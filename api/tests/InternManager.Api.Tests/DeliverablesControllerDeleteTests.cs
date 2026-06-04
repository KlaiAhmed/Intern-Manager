using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class DeliverablesControllerDeleteTests
{
    [Fact]
    public async Task DeleteDeliverable_MissingId_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);

        var result = await controller.DeleteDeliverable(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.Empty(dbContext.Deliverables);
    }

    [Fact]
    public async Task DeleteDeliverable_OwnedMission_ReturnsNoContentAndCascadesVersions()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (missionId, deliverableId) = await SeedMissionAndDeliverableAsync(dbContext, supervisorId, internId);
        dbContext.DeliverableVersions.Add(new DeliverableVersion
        {
            Id = Guid.NewGuid(),
            DeliverableId = deliverableId,
            VersionNumber = 1,
            IsCurrentVersion = true,
            GitHubUrl = "https://github.com/axia/intern-portal",
            Status = DomainStatuses.DeliverableVersion.Submitted,
            SubmittedAt = DateTime.UtcNow,
            SubmittedByUserId = internId
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);
        var result = await controller.DeleteDeliverable(deliverableId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(dbContext.Deliverables);
        Assert.Empty(dbContext.DeliverableVersions);
        Assert.Contains(
            dbContext.AuditLogs,
            log => log.Action == "deliverable.delete" && log.Entity == $"deliverable:{deliverableId}");

        _ = missionId;
    }

    [Fact]
    public async Task DeleteDeliverable_PreservesLinkedTasksWithNullDeliverableId()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (_, deliverableId) = await SeedMissionAndDeliverableAsync(dbContext, supervisorId, internId);
        var taskId = Guid.NewGuid();
        dbContext.InternTasks.Add(new InternTask
        {
            Id = taskId,
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "Linked task",
            Status = DomainStatuses.Task.Todo,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);
        var result = await controller.DeleteDeliverable(deliverableId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        var preservedTask = await dbContext.InternTasks.SingleAsync();
        Assert.Equal(taskId, preservedTask.Id);
        Assert.Null(preservedTask.DeliverableId);
    }

    [Fact]
    public async Task DeleteDeliverable_SupervisorWhoDoesNotOwnMission_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var owningSupervisorId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (_, deliverableId) = await SeedMissionAndDeliverableAsync(dbContext, owningSupervisorId, internId);

        var controller = CreateController(dbContext, otherSupervisorId, UserRole.Supervisor);
        var result = await controller.DeleteDeliverable(deliverableId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.NotEmpty(dbContext.Deliverables);
    }

    [Fact]
    public async Task DeleteDeliverable_Intern_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (_, deliverableId) = await SeedMissionAndDeliverableAsync(dbContext, supervisorId, internId);

        var controller = CreateController(dbContext, internId, UserRole.Intern);
        var result = await controller.DeleteDeliverable(deliverableId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.NotEmpty(dbContext.Deliverables);
    }

    private static DeliverablesController CreateController(AppDbContext dbContext, Guid userId, UserRole role)
    {
        var controller = new DeliverablesController(
            dbContext,
            null!,
            new FakeFileStorageService(),
            new NoopDeliverablesService(),
            new MissionPolicyService(dbContext),
            new NoopTaskStateService(),
            new NoopDeliverableProgressService(),
            new NoopNotificationService(),
            NullLogger<DeliverablesController>.Instance)
        {
            ControllerContext = TestUsers.ControllerContext(userId, role, $"{role.ToString().ToLowerInvariant()}@example.com")
        };

        return controller;
    }

    private static async Task<(Guid MissionId, Guid DeliverableId)> SeedMissionAndDeliverableAsync(
        AppDbContext dbContext,
        Guid supervisorId,
        Guid internId)
    {
        var missionId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor, "supervisor@example.com"));
        dbContext.Users.Add(TestUsers.Create(internId, UserRole.Intern, "intern@example.com"));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Audit mission",
            Description = "Mission for delete tests",
            SkillsJson = "[]",
            Tools = string.Empty,
            Level = "junior",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = now
        });
        dbContext.MissionInternAssignments.Add(new MissionInternAssignment
        {
            MissionId = missionId,
            InternId = internId,
            AssignedAt = now
        });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Auditable deliverable",
            Status = DomainStatuses.Deliverable.Pending,
            FileUrl = string.Empty,
            Version = 1,
            RawProgress = 0m,
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync();

        return (missionId, deliverableId);
    }

    private sealed class NoopNotificationService : INotificationService
    {
        public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
        {
            _ = userId;
            _ = type;
            _ = title;
            _ = message;
            _ = relatedEntity;
        }
    }

    private sealed class NoopDeliverablesService : IDeliverablesService
    {
        public Task<PagedResponse<DeliverableQueueItemResponse>> GetSupervisorDeliverablesAsync(
            Guid supervisorId,
            string? status,
            int page,
            int limit,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<DeliverableReviewResponse> ApproveDeliverableAsync(
            Guid actorId,
            Guid deliverableId,
            int rowVersion,
            CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<DeliverableReviewResponse> RejectDeliverableAsync(
            Guid actorId,
            Guid deliverableId,
            string reason,
            IReadOnlyCollection<Guid> taskIdsToReopen,
            int rowVersion,
            CancellationToken cancellationToken) => throw new NotSupportedException();
    }

    private sealed class NoopTaskStateService : ITaskStateService
    {
        public Task MarkDoneAsync(Guid taskId, Guid actorId, int expectedRowVersion, bool isSupervisorOverride, AppDbContext db) =>
            throw new NotSupportedException();

        public Task RevertToTodoAsync(Guid taskId, Guid actorId, int expectedRowVersion, AppDbContext db) =>
            throw new NotSupportedException();

        public Task ReopenAsync(Guid taskId, Guid actorId, int expectedRowVersion, string reason, AppDbContext db) =>
            throw new NotSupportedException();
    }

    private sealed class NoopDeliverableProgressService : IDeliverableProgressService
    {
        public Task RecalculateAsync(Guid deliverableId, AppDbContext db) => Task.CompletedTask;
    }

    private sealed class FakeFileStorageService : IFileStorageService
    {
        public Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<FileStorageReadResult?> OpenReadAsync(string storageKeyOrUrl, CancellationToken cancellationToken) =>
            Task.FromResult<FileStorageReadResult?>(null);

        public Task DeleteAsync(string storageKeyOrUrl, CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
