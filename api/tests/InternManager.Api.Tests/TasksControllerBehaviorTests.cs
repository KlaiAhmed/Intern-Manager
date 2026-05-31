using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Tests;

public sealed class TasksControllerBehaviorTests
{
    [Fact]
    public async Task GetMyTasks_ReturnsPagedTasksAndRejectsNonInternScope()
    {
        await using var dbContext = TestDbContext.Create();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(internId, UserRole.Intern),
            TestUsers.Create(supervisorId, UserRole.Supervisor));
        dbContext.InternTasks.AddRange(
            new InternTask { Id = Guid.NewGuid(), InternId = internId, Title = "B", Status = DomainStatuses.Task.Done, CreatedAt = DateTime.UtcNow },
            new InternTask { Id = Guid.NewGuid(), InternId = internId, Title = "A", Status = DomainStatuses.Task.Todo, DueDate = DateTime.UtcNow.AddDays(1), CreatedAt = DateTime.UtcNow });
        await dbContext.SaveChangesAsync();

        var internController = CreateController(dbContext, internId, UserRole.Intern);
        var supervisorController = CreateController(dbContext, supervisorId, UserRole.Supervisor);

        var result = await internController.GetMyTasks(page: -1, limit: 500, CancellationToken.None);
        var forbidden = await supervisorController.GetMyTasks(cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, ReadAnonymousProperty(ok.Value, "total"));
        Assert.Equal(1, ReadAnonymousProperty(ok.Value, "page"));
        Assert.Equal(100, ReadAnonymousProperty(ok.Value, "limit"));
        Assert.IsType<ForbidResult>(forbidden);
    }

    [Fact]
    public async Task CompleteTask_TogglesTaskDeliverableAndAudit()
    {
        await using var dbContext = TestDbContext.Create();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = Guid.NewGuid(),
            InternId = internId,
            Title = "Mission",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = Guid.NewGuid(),
            InternId = internId,
            Title = "Deliverable",
            Status = DomainStatuses.Deliverable.Pending,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.InternTasks.Add(new InternTask
        {
            Id = taskId,
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "Task",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, internId, UserRole.Intern);

        var request = new CompleteTaskRequest { RowVersion = 1 };
        var missing = await controller.CompleteTask(Guid.NewGuid(), request, CancellationToken.None);
        var result = await controller.CompleteTask(taskId, request, CancellationToken.None);
        var revertedTask = await dbContext.InternTasks.SingleAsync(task => task.Id == taskId);
        var revert = await controller.CompleteTask(taskId, new CompleteTaskRequest { RowVersion = revertedTask.RowVersion }, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(missing);
        Assert.IsType<OkObjectResult>(result);
        Assert.IsType<OkObjectResult>(revert);
        Assert.Equal(DomainStatuses.Task.Todo, (await dbContext.InternTasks.SingleAsync(task => task.Id == taskId)).Status);
        Assert.Equal(0m, (await dbContext.Deliverables.SingleAsync(deliverable => deliverable.Id == deliverableId)).RawProgress);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.complete");
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.reverted");
    }

    [Fact]
    public async Task AssignTask_ValidatesScopeDeliverableAndCreatesNotification()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Mission",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Deliverable",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var workflow = new FakeTaskWorkflowService { CanAssign = true };
        var notifications = new RecordingNotificationService();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor, workflow, notifications);

        Assert.IsType<BadRequestObjectResult>(await controller.AssignTask(new AssignTaskRequest { InternId = Guid.Empty, Title = "Task" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.AssignTask(new AssignTaskRequest { InternId = internId, Title = "" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.AssignTask(new AssignTaskRequest { InternId = Guid.NewGuid(), Title = "Task" }, CancellationToken.None));

        workflow.CanAssign = false;
        Assert.IsType<ForbidResult>(await controller.AssignTask(new AssignTaskRequest { InternId = internId, Title = "Task" }, CancellationToken.None));

        workflow.CanAssign = true;
        var result = await controller.AssignTask(new AssignTaskRequest
        {
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "  Write report  ",
            Description = "  Draft  ",
            DueDate = DateTime.Now.AddDays(3)
        }, CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result);
        Assert.StartsWith("/api/tasks/", created.Location, StringComparison.Ordinal);
        var task = await dbContext.InternTasks.SingleAsync();
        Assert.Equal("Write report", task.Title);
        Assert.Equal("Draft", task.Description);
        Assert.Equal(deliverableId, task.DeliverableId);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.assign");
        Assert.Contains(notifications.Queued, item => item.UserId == internId && item.Type == "task.assigned");
    }

    [Fact]
    public async Task AssignTask_TriggersFirstTaskTransitionWhenDeliverableIsDraft()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Mission",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Deliverable",
            Status = DomainStatuses.Deliverable.Draft,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var deliverableState = new FakeDeliverableStateService();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor, deliverableState: deliverableState);

        var result = await controller.AssignTask(new AssignTaskRequest
        {
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "Task"
        }, CancellationToken.None);

        Assert.IsType<CreatedResult>(result);
        Assert.Equal(new[] { nameof(IDeliverableStateService.OnFirstTaskCreatedAsync) }, deliverableState.Calls);
        Assert.Equal(new[] { deliverableId }, deliverableState.DeliverableIds);
    }

    [Fact]
    public async Task AssignTask_TriggersReviewInterruptionWhenDeliverableIsAwaitingReview()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Mission",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Deliverable",
            Status = DomainStatuses.Deliverable.AwaitingReview,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var deliverableState = new FakeDeliverableStateService();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor, deliverableState: deliverableState);

        var result = await controller.AssignTask(new AssignTaskRequest
        {
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "Task"
        }, CancellationToken.None);

        Assert.IsType<CreatedResult>(result);
        Assert.Equal(new[] { nameof(IDeliverableStateService.OnTaskAddedWhileInReviewAsync) }, deliverableState.Calls);
        Assert.Equal(new[] { deliverableId }, deliverableState.DeliverableIds);
    }

    private static TasksController CreateController(
        AppDbContext dbContext,
        Guid userId,
        UserRole role,
        FakeTaskWorkflowService? workflow = null,
        RecordingNotificationService? notifications = null,
        FakeDeliverableStateService? deliverableState = null)
    {
        notifications ??= new RecordingNotificationService();
        var progressService = new FakeDeliverableProgressService();
        var taskState = new TaskStateService(progressService, notifications);
        deliverableState ??= new FakeDeliverableStateService();

        return new TasksController(
            dbContext,
            notifications,
            workflow ?? new FakeTaskWorkflowService(),
            taskState,
            deliverableState,
            new MissionPolicyService(dbContext),
            progressService)
        {
            ControllerContext = TestUsers.ControllerContext(userId, role, $"{role.ToString().ToLowerInvariant()}@example.com")
        };
    }

    private static object? ReadAnonymousProperty(object? target, string propertyName)
    {
        return target?.GetType().GetProperty(propertyName)?.GetValue(target);
    }

    private sealed class FakeTaskWorkflowService : ITaskWorkflowService
    {
        public bool CanAssign { get; set; } = true;

        public Task<bool> CanSupervisorAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken)
        {
            return Task.FromResult(CanAssign);
        }
    }

    private sealed class FakeDeliverableStateService : IDeliverableStateService
    {
        public List<string> Calls { get; } = [];

        public List<Guid> DeliverableIds { get; } = [];

        public Task OnFirstTaskCreatedAsync(Guid deliverableId, AppDbContext db)
        {
            Calls.Add(nameof(OnFirstTaskCreatedAsync));
            DeliverableIds.Add(deliverableId);
            return Task.CompletedTask;
        }

        public Task OnTaskAddedWhileInReviewAsync(Guid deliverableId, AppDbContext db)
        {
            Calls.Add(nameof(OnTaskAddedWhileInReviewAsync));
            DeliverableIds.Add(deliverableId);
            return Task.CompletedTask;
        }

        public Task ReopenApprovedAsync(Guid deliverableId, Guid actorId, string reason, AppDbContext db) => Task.CompletedTask;
    }

    private sealed class FakeDeliverableProgressService : IDeliverableProgressService
    {
        public async Task RecalculateAsync(Guid deliverableId, AppDbContext db)
        {
            var deliverable = await db.Deliverables.FindAsync(deliverableId);
            if (deliverable is null)
            {
                return;
            }

            var taskStatuses = await db.InternTasks
                .Where(task => task.DeliverableId == deliverableId &&
                               task.Status != DomainStatuses.Task.Cancelled)
                .Select(task => task.Status)
                .ToListAsync();

            if (taskStatuses.Count == 0)
            {
                deliverable.RawProgress = 0m;
            }
            else
            {
                var doneCount = taskStatuses.Count(status => status == DomainStatuses.Task.Done);
                deliverable.RawProgress = Math.Round((decimal)doneCount / taskStatuses.Count * 100m, 2, MidpointRounding.AwayFromZero);
            }
        }
    }

    private sealed class RecordingNotificationService : INotificationService
    {
        public List<QueuedNotification> Queued { get; } = [];

        public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
        {
            Queued.Add(new QueuedNotification(userId, type));
        }
    }

    private sealed record QueuedNotification(Guid UserId, string Type);
}
