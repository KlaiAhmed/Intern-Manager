using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
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
            new InternTask { Id = Guid.NewGuid(), InternId = internId, Title = "B", IsComplete = true, CreatedAt = DateTime.UtcNow },
            new InternTask { Id = Guid.NewGuid(), InternId = internId, Title = "A", IsComplete = false, DueDate = DateTime.UtcNow.AddDays(1), CreatedAt = DateTime.UtcNow });
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
    public async Task SyncTasksFromDeliverables_AuditsOnlyWhenTasksAreCreated()
    {
        await using var dbContext = TestDbContext.Create();
        var internId = Guid.NewGuid();
        var workflow = new FakeTaskWorkflowService { CreatedCount = 0 };
        var controller = CreateController(dbContext, internId, UserRole.Intern, workflow);

        var noChanges = await controller.SyncTasksFromDeliverables(CancellationToken.None);
        workflow.CreatedCount = 2;
        var created = await controller.SyncTasksFromDeliverables(CancellationToken.None);

        Assert.Equal("No tasks to synchronize.", Assert.IsType<InternManager.Api.Models.Responses.ActionResponse>(Assert.IsType<OkObjectResult>(noChanges).Value).Message);
        Assert.Equal("Created 2 task(s).", Assert.IsType<InternManager.Api.Models.Responses.ActionResponse>(Assert.IsType<OkObjectResult>(created).Value).Message);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.sync");
    }

    [Fact]
    public async Task CompleteTask_UpdatesTaskDeliverableAndAudit()
    {
        await using var dbContext = TestDbContext.Create();
        var internId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = Guid.NewGuid(),
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

        var missing = await controller.CompleteTask(Guid.NewGuid(), CancellationToken.None);
        var result = await controller.CompleteTask(taskId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(missing);
        Assert.IsType<OkObjectResult>(result);
        Assert.True((await dbContext.InternTasks.SingleAsync(task => task.Id == taskId)).IsComplete);
        Assert.Equal(100, (await dbContext.Deliverables.SingleAsync(deliverable => deliverable.Id == deliverableId)).Progress);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.complete");
    }

    [Fact]
    public async Task AssignTask_ValidatesScopeDeliverableAndCreatesNotification()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern));
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = Guid.NewGuid(),
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

    private static TasksController CreateController(
        AppDbContext dbContext,
        Guid userId,
        UserRole role,
        FakeTaskWorkflowService? workflow = null,
        RecordingNotificationService? notifications = null)
    {
        return new TasksController(
            dbContext,
            notifications ?? new RecordingNotificationService(),
            workflow ?? new FakeTaskWorkflowService())
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

        public int CreatedCount { get; set; }

        public Task<bool> CanSupervisorAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken)
        {
            return Task.FromResult(CanAssign);
        }

        public Task<int> EnsureTasksFromDeliverablesAsync(Guid internId, CancellationToken cancellationToken)
        {
            return Task.FromResult(CreatedCount);
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
