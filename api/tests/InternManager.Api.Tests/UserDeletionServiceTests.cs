using InternManager.Api.Application.Users;
using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Tests;

public sealed class UserDeletionServiceTests
{
    [Fact]
    public async Task DeleteUserAsync_ReturnsExpectedErrorsForMissingForbiddenAndActiveUsers()
    {
        await using var dbContext = TestDbContext.Create();
        var adminId = Guid.NewGuid();
        var superAdminId = Guid.NewGuid();
        var activeUserId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(adminId, UserRole.Admin),
            TestUsers.Create(superAdminId, UserRole.SuperAdmin, status: UserStatus.Archived),
            TestUsers.Create(activeUserId, UserRole.Manager));
        await dbContext.SaveChangesAsync();
        var service = new UserDeletionService(dbContext, new UserDeletionPolicy());
        var admin = TestUsers.Principal(adminId, UserRole.Admin, "admin@example.com");

        var missing = await service.DeleteUserAsync(Guid.NewGuid(), admin, CancellationToken.None);
        var forbidden = await service.DeleteUserAsync(superAdminId, admin, CancellationToken.None);
        var active = await service.DeleteUserAsync(activeUserId, admin, CancellationToken.None);

        Assert.Equal(StatusCodes.Status404NotFound, missing.StatusCode);
        Assert.Equal(UserDeletionService.ErrorUserNotFound, missing.Code);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        Assert.Equal(UserDeletionService.ErrorUserDeleteForbidden, forbidden.Code);
        Assert.Equal(StatusCodes.Status409Conflict, active.StatusCode);
        Assert.Equal(UserDeletionService.ErrorUserNotArchived, active.Code);
    }

    [Fact]
    public async Task DeleteUserAsync_ReturnsBlockersBeforeDeletingRestrictedBusinessData()
    {
        await using var dbContext = TestDbContext.Create();
        var userId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var entryId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(userId, UserRole.Supervisor, status: UserStatus.Archived),
            TestUsers.Create(internId, UserRole.Intern));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = userId,
            Title = "Mission",
            Description = "Desc",
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = Guid.NewGuid(),
            MissionId = missionId,
            SupervisorId = userId,
            Title = "Deliverable",
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Evaluations.Add(new Evaluation
        {
            Id = Guid.NewGuid(),
            SupervisorId = userId,
            InternId = internId,
            Type = "mid-term",
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Meetings.Add(new Meeting
        {
            Id = Guid.NewGuid(),
            SupervisorId = userId,
            InternId = internId,
            Date = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.JournalEntries.Add(new JournalEntry
        {
            Id = entryId,
            InternId = internId,
            Content = "Entry",
            CreatedAt = DateTime.UtcNow
        });
        dbContext.JournalComments.Add(new JournalComment
        {
            JournalEntryId = entryId,
            AuthorId = userId,
            Content = "Comment",
            CreatedAt = DateTime.UtcNow
        });
        dbContext.JournalEvaluationLinks.Add(new JournalEvaluationLink
        {
            JournalEntryId = entryId,
            EvaluationCriteria = JournalEvaluationCriteria.Technical,
            LinkedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = new UserDeletionService(dbContext, new UserDeletionPolicy());

        var result = await service.DeleteUserAsync(
            userId,
            TestUsers.Principal(Guid.NewGuid(), UserRole.SuperAdmin, "superadmin@example.com"),
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(UserDeletionService.ErrorUserDeleteBlocked, result.Code);
        Assert.NotNull(result.Blockers);
        Assert.True(result.Blockers.HasBlockers);
        Assert.Equal(1, result.Blockers.MissionsAsSupervisor);
        Assert.Equal(1, result.Blockers.DeliverablesAsSupervisor);
        Assert.Equal(1, result.Blockers.Evaluations);
        Assert.Equal(1, result.Blockers.Meetings);
        Assert.Equal(1, result.Blockers.JournalComments);
        Assert.Equal(1, result.Blockers.JournalEvaluationLinks);
        Assert.True(await dbContext.Users.AnyAsync(user => user.Id == userId));
    }

    [Fact]
    public async Task DeleteUserAsync_DeletesArchivedUserAndCreatesAuditLog()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(actorId, UserRole.SuperAdmin, "superadmin@example.com"),
            TestUsers.Create(userId, UserRole.Manager, "manager@example.com", UserStatus.Archived));
        await dbContext.SaveChangesAsync();
        var service = new UserDeletionService(dbContext, new UserDeletionPolicy());

        var result = await service.DeleteUserAsync(
            userId,
            TestUsers.Principal(actorId, UserRole.SuperAdmin, "superadmin@example.com"),
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(StatusCodes.Status204NoContent, result.StatusCode);
        Assert.False(await dbContext.Users.AnyAsync(user => user.Id == userId));
        Assert.Contains(dbContext.AuditLogs, log =>
            log.Action == "user.delete" &&
            log.Actor == "superadmin@example.com" &&
            log.Entity is not null &&
            log.Entity.Contains("targetEmail=manager@example.com", StringComparison.Ordinal));
    }
}
