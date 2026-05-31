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

public sealed class StagesControllerTests
{
    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task Assign_ReturnsBadRequestForInvalidPayloads(AssignStageRequest request)
    {
        await using var dbContext = TestDbContext.Create();
        var controller = CreateController(dbContext, Guid.NewGuid(), UserRole.Admin);

        var result = await controller.Assign(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Assign_ReturnsUnauthorizedWhenUserIdClaimIsMissing()
    {
        await using var dbContext = TestDbContext.Create();
        var controller = new StagesController(dbContext, new RecordingNotificationService())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.Assign(ValidRequest(Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task Assign_ReturnsNotFoundForMissingMissionOrIntern()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        dbContext.Users.Add(TestUsers.Create(actorId, UserRole.Admin));
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId, UserRole.Admin);

        var missingMission = await controller.Assign(ValidRequest(missionId, internId), CancellationToken.None);

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = Guid.NewGuid(),
            Title = "Mission",
            Description = "Mission",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var missingIntern = await controller.Assign(ValidRequest(missionId, internId), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(missingMission);
        Assert.IsType<NotFoundObjectResult>(missingIntern);
    }

    [Fact]
    public async Task Assign_EnforcesSupervisorOwnershipAndPendingInternStatus()
    {
        await using var dbContext = TestDbContext.Create();
        var ownerSupervisorId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(ownerSupervisorId, UserRole.Supervisor),
            TestUsers.Create(otherSupervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern, verificationStatus: InternVerificationStatus.ACTIVE));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = ownerSupervisorId,
            Title = "Mission",
            Description = "Mission",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var otherSupervisorController = CreateController(dbContext, otherSupervisorId, UserRole.Supervisor);
        var ownerController = CreateController(dbContext, ownerSupervisorId, UserRole.Supervisor);

        var forbidden = await otherSupervisorController.Assign(ValidRequest(missionId, internId), CancellationToken.None);
        var invalidStatus = await ownerController.Assign(ValidRequest(missionId, internId), CancellationToken.None);

        Assert.IsType<ForbidResult>(forbidden);
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(invalidStatus).StatusCode);
    }

    [Fact]
    public async Task Assign_ReturnsConflictForDuplicateOrElsewhereActiveAssignments()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var otherMissionId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor),
            TestUsers.Create(internId, UserRole.Intern, verificationStatus: InternVerificationStatus.PENDING));
        dbContext.Missions.AddRange(
            new Mission
            {
                Id = missionId,
                SupervisorId = supervisorId,
                InternId = internId,
                Title = "Mission",
                Description = "Mission",
                Status = DomainStatuses.Mission.Template,
                CreatedAt = DateTime.UtcNow
            },
            new Mission
            {
                Id = otherMissionId,
                SupervisorId = supervisorId,
                Title = "Other",
                Description = "Other",
                Status = DomainStatuses.Mission.Active,
                CreatedAt = DateTime.UtcNow
            });
        dbContext.MissionInternAssignments.Add(new MissionInternAssignment
        {
            MissionId = otherMissionId,
            InternId = internId,
            AssignedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor);

        var duplicate = await controller.Assign(ValidRequest(missionId, internId), CancellationToken.None);

        dbContext.Missions.Single(mission => mission.Id == missionId).InternId = null;
        await dbContext.SaveChangesAsync();
        var elsewhere = await controller.Assign(ValidRequest(missionId, internId), CancellationToken.None);

        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(duplicate).StatusCode);
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(elsewhere).StatusCode);
    }

    [Fact]
    public async Task Assign_SuccessfullyActivatesInternCreatesProfileTasksHistoryAuditAndNotification()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var notificationService = new RecordingNotificationService();
        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor, "supervisor@example.com"),
            TestUsers.Create(internId, UserRole.Intern, "intern@example.com", verificationStatus: InternVerificationStatus.PENDING));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            Title = "Mission",
            Description = "Mission",
            Status = DomainStatuses.Mission.Template,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = supervisorId,
            Title = "Final report",
            Status = DomainStatuses.Deliverable.Accepted,
            Progress = 100,
            DueDate = DateTime.UtcNow.AddDays(10),
            CreatedAt = DateTime.UtcNow
        });
        dbContext.InternTasks.Add(new InternTask
        {
            Id = Guid.NewGuid(),
            InternId = internId,
            DeliverableId = deliverableId,
            Title = "Old task",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor, notificationService);
        var request = ValidRequest(missionId, internId);

        var result = await controller.Assign(request, CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result);
        Assert.Equal($"/api/interns/{internId}", created.Location);
        var intern = await dbContext.Users.SingleAsync(user => user.Id == internId);
        var mission = await dbContext.Missions.SingleAsync(item => item.Id == missionId);
        var deliverable = await dbContext.Deliverables.SingleAsync(item => item.Id == deliverableId);
        var task = await dbContext.InternTasks.SingleAsync(item => item.InternId == internId && item.DeliverableId == deliverableId);

        Assert.Equal(InternVerificationStatus.ACTIVE, intern.VerificationStatus);
        Assert.Equal(internId, mission.InternId);
        Assert.Equal(DomainStatuses.Mission.Active, mission.Status);
        Assert.Equal(internId, deliverable.InternId);
        Assert.Equal(DomainStatuses.Task.Done, task.Status);
        Assert.NotNull(task.CompletedAt);
        Assert.Contains(dbContext.InternProfiles, profile => profile.InternId == internId && profile.StartDate == request.StartDate);
        Assert.Contains(dbContext.MissionHistoryEntries, entry => entry.MissionId == missionId && entry.Field == "internIds");
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "stage.assign");
        Assert.Contains(notificationService.Queued, item => item.UserId == internId && item.Type == "intern.status.active");
    }

    public static IEnumerable<object[]> InvalidRequests()
    {
        yield return [new AssignStageRequest { MissionId = Guid.Empty, InternId = Guid.NewGuid(), StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow.AddDays(1) }];
        yield return [new AssignStageRequest { MissionId = Guid.NewGuid(), InternId = Guid.Empty, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow.AddDays(1) }];
        yield return [new AssignStageRequest { MissionId = Guid.NewGuid(), InternId = Guid.NewGuid(), StartDate = default, EndDate = DateTime.UtcNow.AddDays(1) }];
        yield return [new AssignStageRequest { MissionId = Guid.NewGuid(), InternId = Guid.NewGuid(), StartDate = DateTime.UtcNow.AddDays(2), EndDate = DateTime.UtcNow.AddDays(1) }];
    }

    private static AssignStageRequest ValidRequest(Guid missionId, Guid internId)
    {
        return new AssignStageRequest
        {
            MissionId = missionId,
            InternId = internId,
            StartDate = DateTime.UtcNow.AddDays(1),
            EndDate = DateTime.UtcNow.AddDays(30)
        };
    }

    private static StagesController CreateController(
        AppDbContext dbContext,
        Guid actorId,
        UserRole role,
        RecordingNotificationService? notificationService = null)
    {
        return new StagesController(dbContext, notificationService ?? new RecordingNotificationService())
        {
            ControllerContext = TestUsers.ControllerContext(actorId, role, $"{role.ToString().ToLowerInvariant()}@example.com")
        };
    }

    private sealed class RecordingNotificationService : INotificationService
    {
        public List<QueuedNotification> Queued { get; } = [];

        public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
        {
            Queued.Add(new QueuedNotification(userId, type, title, message, relatedEntity));
        }
    }

    private sealed record QueuedNotification(
        Guid UserId,
        string Type,
        string Title,
        string Message,
        string? RelatedEntity);
}
