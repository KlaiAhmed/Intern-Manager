using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class DeliverablesConcurrencyTests
{
    [Fact]
    public async Task ApproveDeliverable_StaleRowVersion_ReturnsConflict()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);
        var (deliverableId, currentRowVersion) = await SeedAwaitingReviewDeliverableAsync(
            dbContext, supervisorId, internId, currentRowVersion: 5);

        var result = await controller.ApproveDeliverable(
            deliverableId,
            new ApproveDeliverableRequest { RowVersion = 1 },
            CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.Equal("conflict", GetStringProperty(conflict.Value, "error"));

        var persisted = await dbContext.Deliverables.AsNoTracking().SingleAsync(item => item.Id == deliverableId);
        Assert.Equal(currentRowVersion, persisted.RowVersion);
        Assert.Equal(DomainStatuses.Deliverable.AwaitingReview, persisted.Status);
    }

    [Fact]
    public async Task ApproveDeliverable_ValidRowVersion_ApprovesAndReturnsUpdatedRowVersion()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);
        var (deliverableId, currentRowVersion) = await SeedAwaitingReviewDeliverableAsync(
            dbContext, supervisorId, internId, currentRowVersion: 3);

        var result = await controller.ApproveDeliverable(
            deliverableId,
            new ApproveDeliverableRequest { RowVersion = currentRowVersion },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<DeliverableReviewResponse>(ok.Value);
        Assert.Equal(DomainStatuses.Deliverable.Approved, response.Status);
        Assert.Equal(currentRowVersion + 1, response.RowVersion);

        var persisted = await dbContext.Deliverables.AsNoTracking().SingleAsync(item => item.Id == deliverableId);
        Assert.Equal(DomainStatuses.Deliverable.Approved, persisted.Status);
        Assert.Equal(currentRowVersion + 1, persisted.RowVersion);
    }

    [Fact]
    public async Task RejectDeliverable_StaleRowVersion_ReturnsConflict()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);
        var (deliverableId, _) = await SeedAwaitingReviewDeliverableAsync(
            dbContext, supervisorId, internId, currentRowVersion: 7);

        var result = await controller.RejectDeliverable(
            deliverableId,
            new RejectDeliverableRequest
            {
                Reason = "Please refine the data model and resubmit.",
                TaskIdsToReopen = [],
                RowVersion = 2
            },
            CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.Equal("conflict", GetStringProperty(conflict.Value, "error"));

        var persisted = await dbContext.Deliverables.AsNoTracking().SingleAsync(item => item.Id == deliverableId);
        Assert.Equal(DomainStatuses.Deliverable.AwaitingReview, persisted.Status);
    }

    [Fact]
    public async Task RejectDeliverable_ValidRowVersion_SetsChangesRequestedAndReopensTasks()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);
        var (deliverableId, currentRowVersion) = await SeedAwaitingReviewDeliverableAsync(
            dbContext, supervisorId, internId, currentRowVersion: 4);

        var (task1Id, task2Id, task3Id) = await SeedTasksAsync(dbContext, internId, deliverableId);

        var result = await controller.RejectDeliverable(
            deliverableId,
            new RejectDeliverableRequest
            {
                Reason = "The architecture needs to be revised before resubmission.",
                TaskIdsToReopen = [task1Id, task2Id],
                RowVersion = currentRowVersion
            },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<DeliverableReviewResponse>(ok.Value);
        Assert.Equal(DomainStatuses.Deliverable.ChangesRequested, response.Status);
        Assert.Equal(currentRowVersion + 1, response.RowVersion);

        var persisted = await dbContext.Deliverables.AsNoTracking().SingleAsync(item => item.Id == deliverableId);
        Assert.Equal(DomainStatuses.Deliverable.ChangesRequested, persisted.Status);
        Assert.Equal(currentRowVersion + 1, persisted.RowVersion);

        var tasks = await dbContext.InternTasks.AsNoTracking()
            .Where(task => task.DeliverableId == deliverableId)
            .ToDictionaryAsync(task => task.Id);

        Assert.Equal(DomainStatuses.Task.Reopened, tasks[task1Id].Status);
        Assert.Equal(DomainStatuses.Task.Reopened, tasks[task2Id].Status);
        Assert.Equal(DomainStatuses.Task.Done, tasks[task3Id].Status);
    }

    [Fact]
    public async Task GetSupervisorDeliverablesAsync_ReturnsRowVersionOnEachDeliverable()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        await SeedAwaitingReviewDeliverableAsync(dbContext, supervisorId, internId, currentRowVersion: 1);
        await SeedAwaitingReviewDeliverableAsync(dbContext, supervisorId, internId, currentRowVersion: 9);

        var missionPolicyService = new MissionPolicyService(dbContext);
        var notificationService = new NotificationService(dbContext);
        var missionProgressService = new MissionProgressService();
        var deliverableProgressService = new DeliverableProgressService(missionProgressService);
        var missionStateService = new MissionStateService(notificationService);
        var service = new DeliverablesService(
            dbContext,
            notificationService,
            deliverableProgressService,
            missionProgressService,
            missionStateService);

        var response = await service.GetSupervisorDeliverablesAsync(
            supervisorId,
            status: null,
            page: 1,
            limit: 20,
            cancellationToken: CancellationToken.None);

        Assert.Equal(2, response.Total);
        Assert.All(response.Data, item => Assert.True(item.RowVersion > 0));
    }

    private static DeliverablesController CreateController(
        AppDbContext dbContext,
        Guid userId,
        UserRole role)
    {
        var notificationService = new NotificationService(dbContext);
        var missionProgressService = new MissionProgressService();
        var deliverableProgressService = new DeliverableProgressService(missionProgressService);
        var missionStateService = new MissionStateService(notificationService);
        var taskStateService = new TaskStateService(deliverableProgressService, notificationService);
        var deliverablesService = new DeliverablesService(
            dbContext,
            notificationService,
            deliverableProgressService,
            missionProgressService,
            missionStateService);

        return new DeliverablesController(
            dbContext,
            null!,
            new NoopFileStorageService(),
            deliverablesService,
            new MissionPolicyService(dbContext),
            taskStateService,
            deliverableProgressService,
            notificationService,
            NullLogger<DeliverablesController>.Instance)
        {
            ControllerContext = TestUsers.ControllerContext(userId, role, $"{role.ToString().ToLowerInvariant()}@example.com")
        };
    }

    private static async Task<(Guid DeliverableId, int CurrentRowVersion)> SeedAwaitingReviewDeliverableAsync(
        AppDbContext dbContext,
        Guid supervisorId,
        Guid internId,
        int currentRowVersion)
    {
        var missionId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor, "supervisor@example.com"),
            TestUsers.Create(internId, UserRole.Intern, "intern@example.com"));

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Concurrency test mission",
            Description = "Mission for concurrency tests",
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
            Title = "Awaiting review deliverable",
            Status = DomainStatuses.Deliverable.AwaitingReview,
            FileUrl = string.Empty,
            Version = 1,
            RowVersion = currentRowVersion,
            RawProgress = 50m,
            CreatedAt = now
        });

        await dbContext.SaveChangesAsync();

        return (deliverableId, currentRowVersion);
    }

    private static async Task<(Guid Task1, Guid Task2, Guid Task3)> SeedTasksAsync(
        AppDbContext dbContext,
        Guid internId,
        Guid deliverableId)
    {
        var now = DateTime.UtcNow;
        var task1Id = Guid.NewGuid();
        var task2Id = Guid.NewGuid();
        var task3Id = Guid.NewGuid();

        dbContext.InternTasks.AddRange(
            new InternTask
            {
                Id = task1Id,
                InternId = internId,
                DeliverableId = deliverableId,
                Title = "Reopen me 1",
                Status = DomainStatuses.Task.Done,
                CompletedAt = now.AddDays(-1),
                StatusChangedAt = now.AddDays(-1),
                CreatedAt = now.AddDays(-2)
            },
            new InternTask
            {
                Id = task2Id,
                InternId = internId,
                DeliverableId = deliverableId,
                Title = "Reopen me 2",
                Status = DomainStatuses.Task.Done,
                CompletedAt = now.AddDays(-1),
                StatusChangedAt = now.AddDays(-1),
                CreatedAt = now.AddDays(-2)
            },
            new InternTask
            {
                Id = task3Id,
                InternId = internId,
                DeliverableId = deliverableId,
                Title = "Keep me done",
                Status = DomainStatuses.Task.Done,
                CompletedAt = now.AddDays(-1),
                StatusChangedAt = now.AddDays(-1),
                CreatedAt = now.AddDays(-2)
            });

        await dbContext.SaveChangesAsync();

        return (task1Id, task2Id, task3Id);
    }

    private static string? GetStringProperty(object? value, string propertyName)
    {
        if (value is null)
        {
            return null;
        }

        var property = value.GetType().GetProperty(propertyName);
        return property?.GetValue(value) as string;
    }

    private sealed class NoopFileStorageService : IFileStorageService
    {
        public Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<FileStorageReadResult?> OpenReadAsync(string storageKeyOrUrl, CancellationToken cancellationToken) =>
            Task.FromResult<FileStorageReadResult?>(null);

        public Task DeleteAsync(string storageKeyOrUrl, CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
