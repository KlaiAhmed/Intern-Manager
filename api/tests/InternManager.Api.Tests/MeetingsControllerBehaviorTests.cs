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

public sealed class MeetingsControllerBehaviorTests
{
    [Fact]
    public async Task GetMeetings_AppliesRoleScopeCountAndPagination()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        SeedUsersAndMeeting(dbContext, supervisorId, internId, out _);
        await dbContext.SaveChangesAsync();

        var internController = CreateController(dbContext, internId, UserRole.Intern);
        var supervisorController = CreateController(dbContext, supervisorId, UserRole.Supervisor);
        var adminController = CreateController(dbContext, Guid.NewGuid(), UserRole.Admin);

        Assert.IsType<ForbidResult>(await internController.GetMeetings(internId: Guid.NewGuid().ToString(), cancellationToken: CancellationToken.None));
        Assert.Equal(1, ReadAnonymousProperty(Assert.IsType<OkObjectResult>(await internController.GetMeetings(upcoming: true, count: true, cancellationToken: CancellationToken.None)).Value, "count"));
        Assert.Equal(1, ReadAnonymousProperty(Assert.IsType<OkObjectResult>(await supervisorController.GetMeetings(supervisorId: "me", page: -1, limit: 500, cancellationToken: CancellationToken.None)).Value, "total"));
        Assert.IsType<BadRequestObjectResult>(await adminController.GetMeetings(supervisorId: "not-a-guid", cancellationToken: CancellationToken.None));
        Assert.Equal(1, ReadAnonymousProperty(Assert.IsType<OkObjectResult>(await adminController.GetMeetings(supervisorId: supervisorId.ToString(), count: true, cancellationToken: CancellationToken.None)).Value, "count"));
    }

    [Fact]
    public async Task CreateMeeting_ValidatesInputScopeConflictsAndCreatesNotification()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        SeedUsersAndMeeting(dbContext, supervisorId, internId, out var existingMeetingId);
        await dbContext.SaveChangesAsync();
        var scope = new FakeSupervisorScopeService(new HashSet<Guid> { internId });
        var notifications = new RecordingNotificationService();
        var controller = CreateController(dbContext, supervisorId, UserRole.Supervisor, scope, notifications);

        Assert.IsType<BadRequestObjectResult>(await controller.CreateMeeting(new CreateMeetingRequest { InternId = Guid.Empty, Date = DateTime.UtcNow.AddDays(1) }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.CreateMeeting(new CreateMeetingRequest { InternId = internId, Date = default }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.CreateMeeting(new CreateMeetingRequest { InternId = internId, Date = DateTime.UtcNow.AddDays(-1) }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.CreateMeeting(new CreateMeetingRequest { InternId = Guid.NewGuid(), Date = DateTime.UtcNow.AddDays(2) }, CancellationToken.None));
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(await controller.CreateMeeting(new CreateMeetingRequest { InternId = internId, Date = DateTime.UtcNow.AddDays(1).AddMinutes(30) }, CancellationToken.None)).StatusCode);

        var result = await controller.CreateMeeting(new CreateMeetingRequest
        {
            InternId = internId,
            Date = DateTime.UtcNow.AddDays(3),
            Notes = "  Planning  "
        }, CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(2, await dbContext.Meetings.CountAsync());
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "meeting.create");
        Assert.Contains(notifications.Queued, item => item.Type == "meeting.reminder" && item.UserId == internId);
        Assert.True(await dbContext.Meetings.AnyAsync(meeting => meeting.Id == existingMeetingId));
    }

    [Fact]
    public async Task GetUpdateAndDeleteMeeting_EnforceParticipantsAndPersistChanges()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        SeedUsersAndMeeting(dbContext, supervisorId, internId, out var meetingId);
        dbContext.Users.Add(TestUsers.Create(otherSupervisorId, UserRole.Supervisor));
        dbContext.Meetings.Add(new Meeting
        {
            Id = Guid.NewGuid(),
            SupervisorId = supervisorId,
            InternId = internId,
            Date = DateTime.UtcNow.AddDays(5),
            Notes = "Other",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var notifications = new RecordingNotificationService();
        var supervisorController = CreateController(dbContext, supervisorId, UserRole.Supervisor, notifications: notifications);
        var otherSupervisorController = CreateController(dbContext, otherSupervisorId, UserRole.Supervisor);

        Assert.IsType<ForbidResult>(await otherSupervisorController.GetMeetingById(meetingId, CancellationToken.None));
        Assert.IsType<OkObjectResult>(await supervisorController.GetMeetingById(meetingId, CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await otherSupervisorController.UpdateMeeting(meetingId, new UpdateMeetingRequest { Notes = "Nope" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await supervisorController.UpdateMeeting(meetingId, new UpdateMeetingRequest { Date = DateTime.UtcNow.AddDays(-1) }, CancellationToken.None));
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(await supervisorController.UpdateMeeting(meetingId, new UpdateMeetingRequest { Date = DateTime.UtcNow.AddDays(5).AddMinutes(10) }, CancellationToken.None)).StatusCode);

        var updated = await supervisorController.UpdateMeeting(meetingId, new UpdateMeetingRequest
        {
            Date = DateTime.UtcNow.AddDays(7),
            Notes = " Updated "
        }, CancellationToken.None);

        Assert.IsType<OkObjectResult>(updated);
        Assert.Equal("Updated", (await dbContext.Meetings.SingleAsync(meeting => meeting.Id == meetingId)).Notes);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "meeting.update");
        Assert.Contains(notifications.Queued, item => item.Type == "meeting.reminder");

        Assert.IsType<NotFoundObjectResult>(await otherSupervisorController.DeleteMeeting(meetingId, CancellationToken.None));
        Assert.IsType<NoContentResult>(await supervisorController.DeleteMeeting(meetingId, CancellationToken.None));
        Assert.False(await dbContext.Meetings.AnyAsync(meeting => meeting.Id == meetingId));
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "meeting.delete");
    }

    private static MeetingsController CreateController(
        AppDbContext dbContext,
        Guid userId,
        UserRole role,
        FakeSupervisorScopeService? scope = null,
        RecordingNotificationService? notifications = null)
    {
        return new MeetingsController(
            dbContext,
            notifications ?? new RecordingNotificationService(),
            scope ?? new FakeSupervisorScopeService(new HashSet<Guid>()))
        {
            ControllerContext = TestUsers.ControllerContext(userId, role, $"{role.ToString().ToLowerInvariant()}@example.com")
        };
    }

    private static void SeedUsersAndMeeting(AppDbContext dbContext, Guid supervisorId, Guid internId, out Guid meetingId)
    {
        meetingId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(supervisorId, UserRole.Supervisor, "supervisor@example.com"),
            TestUsers.Create(internId, UserRole.Intern, "intern@example.com"));
        dbContext.Meetings.Add(new Meeting
        {
            Id = meetingId,
            SupervisorId = supervisorId,
            InternId = internId,
            Date = DateTime.UtcNow.AddDays(1),
            Notes = "Sync",
            CreatedAt = DateTime.UtcNow
        });
    }

    private static object? ReadAnonymousProperty(object? target, string propertyName)
    {
        return target?.GetType().GetProperty(propertyName)?.GetValue(target);
    }

    private sealed class FakeSupervisorScopeService(IReadOnlySet<Guid> assignedInternIds) : ISupervisorScopeService
    {
        public Task<IReadOnlySet<Guid>> GetAssignedInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
        {
            return Task.FromResult(assignedInternIds);
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
