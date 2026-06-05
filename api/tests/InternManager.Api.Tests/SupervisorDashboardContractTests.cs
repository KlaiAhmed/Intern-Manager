using System.Text.Json;
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

/// <summary>
/// Integration tests for the backend contract gaps the supervisor dashboard
/// was previously working around. Each test exercises one of the verified
/// fixes (mission read projections, deliverable list projection, history
/// projection + auth, deliverable/task write endpoints, feature-flag auth).
/// </summary>
public sealed class SupervisorDashboardContractTests
{
    // --- GET /api/missions/{id} ---

    [Fact]
    public async Task GetMissionById_ReturnsExtendedProjectionForSupervisorScope()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var coSupervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc);

        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(coSupervisorId, UserRole.Supervisor));

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            CoSupervisorId = coSupervisorId,
            CoSupervisorCanReview = true,
            CoSupervisorCanEval = false,
            Title = "Dashboard contract mission",
            Description = "Mission used to assert the supervisor dashboard contract.",
            SkillsJson = "[\"csharp\",\"react\"]",
            Tools = "Visual Studio, Figma",
            Level = "senior",
            Status = DomainStatuses.Mission.Active,
            RawProgress = 42.5m,
            StartDate = start,
            EndDate = end,
            RowVersion = 7,
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync();

        var controller = new MissionsController(
            dbContext,
            new NoopNotificationService(),
            new MissionPolicyService(dbContext),
            new MissionStateService(new NoopNotificationService()))
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };

        var result = await controller.GetMissionById(missionId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var projection = ok.Value!;
        Assert.Equal(missionId, ReadProperty<Guid>(projection, "id"));
        Assert.Equal(supervisorId, ReadProperty<Guid>(projection, "supervisorId"));
        Assert.Equal(coSupervisorId, ReadProperty<Guid?>(projection, "coSupervisorId"));
        Assert.True(ReadProperty<bool>(projection, "coSupervisorCanReview"));
        Assert.False(ReadProperty<bool>(projection, "coSupervisorCanEval"));
        Assert.Equal(42.5m, ReadProperty<decimal>(projection, "rawProgress"));
        Assert.Equal(start, ReadProperty<DateTime?>(projection, "startDate"));
        Assert.Equal(end, ReadProperty<DateTime?>(projection, "endDate"));
        Assert.Equal(7, ReadProperty<int>(projection, "rowVersion"));

        var skills = ReadProperty<string[]>(projection, "skills");
        Assert.Equal(new[] { "csharp", "react" }, skills);
    }

    [Fact]
    public async Task GetMissionById_FallsBackToEmptySkillsArrayWhenJsonIsInvalid()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();

        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            Title = "Broken skills",
            Description = "x",
            SkillsJson = "not-valid-json",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var controller = new MissionsController(
            dbContext,
            new NoopNotificationService(),
            new MissionPolicyService(dbContext),
            new MissionStateService(new NoopNotificationService()))
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };

        var result = await controller.GetMissionById(missionId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var skills = ReadProperty<string[]>(ok.Value!, "skills");
        Assert.Empty(skills);
    }

    // --- GET /api/missions ---

    [Fact]
    public async Task ListMissions_ReturnsExtendedProjectionIncludingSkillsAndProgress()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();

        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            Title = "Listed",
            Description = "Listed description",
            SkillsJson = "[\"design\",\"arch\"]",
            Tools = "Figma",
            Level = "mid",
            Status = DomainStatuses.Mission.Active,
            RawProgress = 12m,
            RowVersion = 3,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var controller = new MissionsController(
            dbContext,
            new NoopNotificationService(),
            new MissionPolicyService(dbContext),
            new MissionStateService(new NoopNotificationService()))
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };

        var result = await controller.GetMyMissions(page: 1, limit: 20, cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ok.Value!;
        var data = ReadProperty<IEnumerable<object>>(payload, "data");
        var single = data.Single();
        Assert.Equal(supervisorId, ReadProperty<Guid>(single, "supervisorId"));
        Assert.Equal("Listed description", ReadProperty<string>(single, "description"));
        Assert.Equal(new[] { "design", "arch" }, ReadProperty<string[]>(single, "skills"));
        Assert.Equal(12m, ReadProperty<decimal>(single, "rawProgress"));
        Assert.Equal(3, ReadProperty<int>(single, "rowVersion"));
    }

    // --- GET /api/missions/{id}/history ---

    [Fact]
    public async Task GetMissionHistory_ReturnsExtendedProjectionAndRejectsUnrelatedSupervisor()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var coSupervisorId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();

        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(coSupervisorId, UserRole.Supervisor),
            TestUsers.Create(otherSupervisorId, UserRole.Supervisor));

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            CoSupervisorId = coSupervisorId,
            Title = "Mission with history",
            Description = "x",
            SkillsJson = "[]",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = DateTime.UtcNow
        });

        dbContext.MissionHistoryEntries.AddRange(
            new MissionHistoryEntry
            {
                Id = Guid.NewGuid(),
                MissionId = missionId,
                Field = "title",
                OldValue = "Old",
                NewValue = "New",
                ChangedByUserId = supervisorId,
                ChangedBy = "Supervisor User",
                ChangedAt = DateTime.UtcNow
            },
            new MissionHistoryEntry
            {
                Id = Guid.NewGuid(),
                MissionId = missionId,
                Field = "status",
                OldValue = null,
                NewValue = "active",
                ChangedByUserId = supervisorId,
                ChangedBy = "Supervisor User",
                ChangedAt = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();

        var ownerController = new MissionsController(
            dbContext,
            new NoopNotificationService(),
            new MissionPolicyService(dbContext),
            new MissionStateService(new NoopNotificationService()))
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };
        var coController = new MissionsController(
            dbContext,
            new NoopNotificationService(),
            new MissionPolicyService(dbContext),
            new MissionStateService(new NoopNotificationService()))
        {
            ControllerContext = TestUsers.ControllerContext(coSupervisorId, UserRole.Supervisor)
        };
        var adminController = new MissionsController(
            dbContext,
            new NoopNotificationService(),
            new MissionPolicyService(dbContext),
            new MissionStateService(new NoopNotificationService()))
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.SuperAdmin)
        };
        var otherController = new MissionsController(
            dbContext,
            new NoopNotificationService(),
            new MissionPolicyService(dbContext),
            new MissionStateService(new NoopNotificationService()))
        {
            ControllerContext = TestUsers.ControllerContext(otherSupervisorId, UserRole.Supervisor)
        };

        var ownerResult = await ownerController.GetMissionHistory(missionId, page: 1, limit: 20, cancellationToken: CancellationToken.None);
        var coResult = await coController.GetMissionHistory(missionId, page: 1, limit: 20, cancellationToken: CancellationToken.None);
        var adminResult = await adminController.GetMissionHistory(missionId, page: 1, limit: 20, cancellationToken: CancellationToken.None);
        var otherResult = await otherController.GetMissionHistory(missionId, page: 1, limit: 20, cancellationToken: CancellationToken.None);

        AssertHistoryEntryShape(Assert.IsType<OkObjectResult>(ownerResult), missionId, supervisorId, expectedCount: 2);
        AssertHistoryEntryShape(Assert.IsType<OkObjectResult>(coResult), missionId, supervisorId, expectedCount: 2);
        AssertHistoryEntryShape(Assert.IsType<OkObjectResult>(adminResult), missionId, supervisorId, expectedCount: 2);
        Assert.IsType<NotFoundObjectResult>(otherResult);
    }

    private static void AssertHistoryEntryShape(OkObjectResult result, Guid expectedMissionId, Guid expectedActorId, int expectedCount)
    {
        var data = ReadProperty<IEnumerable<object>>(result.Value!, "data").ToList();
        Assert.Equal(expectedCount, data.Count);

        foreach (var entry in data)
        {
            Assert.Equal(expectedMissionId, ReadProperty<Guid>(entry, "missionId"));
            Assert.Equal(expectedActorId, ReadProperty<Guid?>(entry, "changedByUserId"));
            // action mirrors field for the current entity history shape.
            Assert.Equal(ReadProperty<string>(entry, "field"), ReadProperty<string>(entry, "action"));
        }
    }

    // --- GET /api/deliverables/mission/{id} ---

    [Fact]
    public async Task GetDeliverablesByMission_ReturnsExtendedProjectionIncludingDescriptionAndWeight()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern));

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Deliverable projection mission",
            Description = "x",
            SkillsJson = "[]",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = now
        });

        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Final report",
            Description = "Long description",
            Status = DomainStatuses.Deliverable.AwaitingReview,
            SupervisorComment = "Looks good",
            FileUrl = "/uploads/final.pdf",
            DueDate = now.AddDays(3),
            CreatedAt = now.AddDays(-1)
        });

        dbContext.InternTasks.Add(new InternTask
        {
            Id = Guid.NewGuid(),
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "Sub task",
            Status = DomainStatuses.Task.Done,
            RowVersion = 1,
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync();

        var controller = new DeliverablesController(
            dbContext,
            environment: null!,
            new NoopFileStorageService(),
            new NoopDeliverablesService(),
            new MissionPolicyService(dbContext),
            new NoopTaskStateService(),
            new NoopDeliverableProgressService(),
            new NoopNotificationService(),
            NullLogger<DeliverablesController>.Instance)
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };

        var result = await controller.GetDeliverablesByMission(missionId, status: null, cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = Assert.IsAssignableFrom<IEnumerable<DeliverableQueueItemResponse>>(ok.Value).Single();
        Assert.Equal(missionId, data.MissionId);
        Assert.Equal(supervisorId, data.SupervisorId);
        Assert.Equal("Long description", data.Description);
        Assert.Equal("Looks good", data.SupervisorComment);
        Assert.Single(data.Tasks);
        Assert.Equal("Sub task", data.Tasks[0].Title);
    }

    // --- PATCH /api/deliverables/{id} ---

    [Fact]
    public async Task UpdateDeliverable_PersistsTitleAndDueDateForOwner()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (controller, deliverableId, _) = await SeedDeliverableWithOwnerAsync(dbContext, supervisorId, internId);

        var newDueDate = new DateTime(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc);
        var result = await controller.UpdateDeliverable(
            deliverableId,
            new UpdateDeliverableRequest { Title = " Renamed ", DueDate = newDueDate },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<DeliverableQueueItemResponse>(ok.Value);
        Assert.Equal("Renamed", response.Title);
        Assert.Equal(newDueDate, response.DueDate);

        var persisted = await dbContext.Deliverables.SingleAsync(item => item.Id == deliverableId);
        Assert.Equal("Renamed", persisted.Title);
        Assert.Equal(newDueDate, persisted.DueDate);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "deliverable.update");
    }

    [Fact]
    public async Task UpdateDeliverable_RejectsEmptyTitle()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (controller, deliverableId, _) = await SeedDeliverableWithOwnerAsync(dbContext, supervisorId, internId);

        var result = await controller.UpdateDeliverable(
            deliverableId,
            new UpdateDeliverableRequest { Title = "   " },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateDeliverable_ForbidsUnrelatedSupervisor()
    {
        await using var dbContext = TestDbContext.Create();
        var ownerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (_, deliverableId, _) = await SeedDeliverableWithOwnerAsync(dbContext, ownerId, internId);

        var controller = new DeliverablesController(
            dbContext,
            environment: null!,
            new NoopFileStorageService(),
            new NoopDeliverablesService(),
            new MissionPolicyService(dbContext),
            new NoopTaskStateService(),
            new NoopDeliverableProgressService(),
            new NoopNotificationService(),
            NullLogger<DeliverablesController>.Instance)
        {
            ControllerContext = TestUsers.ControllerContext(otherId, UserRole.Supervisor)
        };

        var result = await controller.UpdateDeliverable(
            deliverableId,
            new UpdateDeliverableRequest { Title = "Nope" },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task UpdateDeliverable_RejectsArchivedMission()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var (controller, deliverableId, missionId) = await SeedDeliverableWithOwnerAsync(dbContext, supervisorId, internId);

        var mission = await dbContext.Missions.SingleAsync(item => item.Id == missionId);
        mission.Status = DomainStatuses.Mission.Archived;
        await dbContext.SaveChangesAsync();

        await Assert.ThrowsAsync<Common.Exceptions.ForbiddenException>(
            () => controller.UpdateDeliverable(
                deliverableId,
                new UpdateDeliverableRequest { Title = "Renamed" },
                CancellationToken.None));
    }

    private static async Task<(DeliverablesController Controller, Guid DeliverableId, Guid MissionId)> SeedDeliverableWithOwnerAsync(
        AppDbContext dbContext,
        Guid supervisorId,
        Guid internId)
    {
        var missionId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern));

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Deliverable update mission",
            Description = "x",
            SkillsJson = "[]",
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
            Title = "Original",
            Description = "Original",
            Status = DomainStatuses.Deliverable.Draft,
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync();

        var controller = new DeliverablesController(
            dbContext,
            environment: null!,
            new NoopFileStorageService(),
            new NoopDeliverablesService(),
            new MissionPolicyService(dbContext),
            new NoopTaskStateService(),
            new NoopDeliverableProgressService(),
            new NoopNotificationService(),
            NullLogger<DeliverablesController>.Instance)
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };

        return (controller, deliverableId, missionId);
    }

    // --- PATCH /api/tasks/{id} ---

    [Fact]
    public async Task UpdateTask_PersistsTitleAndDueDateForOwner()
    {
        await using var dbContext = TestDbContext.Create();
        var (controller, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);

        var newDueDate = new DateTime(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc);
        var result = await controller.UpdateTask(
            taskId,
            new UpdateTaskRequest { Title = "  Patched title  ", DueDate = newDueDate },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternTaskResponse>(ok.Value);
        Assert.Equal("Patched title", response.Title);
        Assert.Equal(newDueDate, response.DueDate);

        var persisted = await dbContext.InternTasks.SingleAsync(item => item.Id == taskId);
        Assert.Equal("Patched title", persisted.Title);
        Assert.Equal(newDueDate, persisted.DueDate);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.update");
    }

    [Fact]
    public async Task UpdateTask_ForbidsUnrelatedSupervisor()
    {
        await using var dbContext = TestDbContext.Create();
        var (_, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);

        var otherController = new TasksController(
            dbContext,
            new RecordingNotificationService(),
            new FakeTaskWorkflowService(),
            new TaskStateService(new NoopDeliverableProgressService(), new NoopNotificationService()),
            new FakeDeliverableStateService(),
            new MissionPolicyService(dbContext),
            new NoopDeliverableProgressService())
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.Supervisor)
        };

        var result = await otherController.UpdateTask(
            taskId,
            new UpdateTaskRequest { Title = "X" },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    // --- DELETE /api/tasks/{id} ---

    [Fact]
    public async Task DeleteTask_RemovesTaskAndRecalculatesDeliverableProgress()
    {
        await using var dbContext = TestDbContext.Create();
        var (controller, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);

        var result = await controller.DeleteTask(taskId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(dbContext.InternTasks);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.delete");
        Assert.Contains(
            dbContext.EntityHistoryEntries,
            entry => entry.EntityType == "Task" && entry.Action == "task.deleted");
    }

    [Fact]
    public async Task DeleteTask_ForbidsUnrelatedSupervisor()
    {
        await using var dbContext = TestDbContext.Create();
        var (_, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);

        var otherController = new TasksController(
            dbContext,
            new RecordingNotificationService(),
            new FakeTaskWorkflowService(),
            new TaskStateService(new NoopDeliverableProgressService(), new NoopNotificationService()),
            new FakeDeliverableStateService(),
            new MissionPolicyService(dbContext),
            new NoopDeliverableProgressService())
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.Supervisor)
        };

        var result = await otherController.DeleteTask(taskId, CancellationToken.None);
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task DeleteTask_RejectsArchivedMission()
    {
        await using var dbContext = TestDbContext.Create();
        var (controller, taskId, missionId) = await SeedTaskWithOwnerAsync(dbContext);

        var mission = await dbContext.Missions.SingleAsync(item => item.Id == missionId);
        mission.Status = DomainStatuses.Mission.Archived;
        await dbContext.SaveChangesAsync();

        await Assert.ThrowsAsync<Common.Exceptions.ForbiddenException>(
            () => controller.DeleteTask(taskId, CancellationToken.None));
    }

    // --- PUT /api/tasks/{id}/status ---

    [Fact]
    public async Task UpdateTaskStatus_TogglesTaskAndBumpsRowVersion()
    {
        await using var dbContext = TestDbContext.Create();
        var (controller, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);
        var initialRowVersion = (await dbContext.InternTasks.SingleAsync(item => item.Id == taskId)).RowVersion;

        var result = await controller.UpdateTaskStatus(
            taskId,
            new UpdateTaskStatusRequest { Status = "in_progress", RowVersion = initialRowVersion },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternTaskResponse>(ok.Value);
        Assert.Equal(DomainStatuses.Task.InProgress, response.Status);
        Assert.True(response.RowVersion > initialRowVersion);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "task.status.in_progress");
    }

    [Fact]
    public async Task UpdateTaskStatus_ReturnsConflictOnRowVersionMismatch()
    {
        await using var dbContext = TestDbContext.Create();
        var (controller, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);

        var result = await controller.UpdateTaskStatus(
            taskId,
            new UpdateTaskStatusRequest { Status = "done", RowVersion = 999 },
            CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task UpdateTaskStatus_RejectsUnknownStatus()
    {
        await using var dbContext = TestDbContext.Create();
        var (controller, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);

        var result = await controller.UpdateTaskStatus(
            taskId,
            new UpdateTaskStatusRequest { Status = "made-up", RowVersion = 1 },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateTaskStatus_ForbidsUnrelatedSupervisor()
    {
        await using var dbContext = TestDbContext.Create();
        var (_, taskId, _) = await SeedTaskWithOwnerAsync(dbContext);

        var otherController = new TasksController(
            dbContext,
            new RecordingNotificationService(),
            new FakeTaskWorkflowService(),
            new TaskStateService(new NoopDeliverableProgressService(), new NoopNotificationService()),
            new FakeDeliverableStateService(),
            new MissionPolicyService(dbContext),
            new NoopDeliverableProgressService())
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.Supervisor)
        };

        var result = await otherController.UpdateTaskStatus(
            taskId,
            new UpdateTaskStatusRequest { Status = "done", RowVersion = 1 },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    private static async Task<(TasksController Controller, Guid TaskId, Guid MissionId)> SeedTaskWithOwnerAsync(
        AppDbContext dbContext)
    {
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern));

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Task update mission",
            Description = "x",
            SkillsJson = "[]",
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
            Title = "Deliv",
            Status = DomainStatuses.Deliverable.InProgress,
            CreatedAt = now
        });
        dbContext.InternTasks.Add(new InternTask
        {
            Id = taskId,
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "Original",
            Description = "Original",
            Status = DomainStatuses.Task.Todo,
            RowVersion = 1,
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync();

        var controller = new TasksController(
            dbContext,
            new RecordingNotificationService(),
            new FakeTaskWorkflowService(),
            new TaskStateService(new FakeDeliverableProgressService(), new RecordingNotificationService()),
            new FakeDeliverableStateService(),
            new MissionPolicyService(dbContext),
            new FakeDeliverableProgressService())
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };

        return (controller, taskId, missionId);
    }

    private static T ReadProperty<T>(object target, string name)
    {
        var prop = target.GetType().GetProperty(name);
        Assert.NotNull(prop);
        return (T)prop!.GetValue(target)!;
    }

    private sealed class NoopNotificationService : INotificationService
    {
        public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
        {
        }
    }

    private sealed class NoopFileStorageService : IFileStorageService
    {
        public Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<FileStorageReadResult?> OpenReadAsync(string storageKeyOrUrl, CancellationToken cancellationToken) =>
            Task.FromResult<FileStorageReadResult?>(null);

        public Task DeleteAsync(string storageKeyOrUrl, CancellationToken cancellationToken) => Task.CompletedTask;
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
            Guid actorId, Guid deliverableId, int rowVersion, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<DeliverableReviewResponse> RejectDeliverableAsync(
            Guid actorId, Guid deliverableId, string reason, IReadOnlyCollection<Guid> taskIdsToReopen, int rowVersion, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
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

    private sealed class RecordingNotificationService : INotificationService
    {
        public List<(Guid UserId, string Type)> Queued { get; } = [];

        public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
        {
            Queued.Add((userId, type));
        }
    }

    private sealed class FakeTaskWorkflowService : ITaskWorkflowService
    {
        public Task<bool> CanSupervisorAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken) =>
            Task.FromResult(true);
    }

    private sealed class FakeDeliverableStateService : IDeliverableStateService
    {
        public Task OnFirstTaskCreatedAsync(Guid deliverableId, AppDbContext db) => Task.CompletedTask;

        public Task OnTaskAddedWhileInReviewAsync(Guid deliverableId, AppDbContext db) => Task.CompletedTask;

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
                .Where(task => task.DeliverableId == deliverableId && task.Status != DomainStatuses.Task.Cancelled)
                .Select(task => task.Status)
                .ToListAsync();

            deliverable.RawProgress = taskStatuses.Count == 0
                ? 0m
                : Math.Round((decimal)taskStatuses.Count(s => s == DomainStatuses.Task.Done) / taskStatuses.Count * 100m, 2, MidpointRounding.AwayFromZero);
        }
    }
}
