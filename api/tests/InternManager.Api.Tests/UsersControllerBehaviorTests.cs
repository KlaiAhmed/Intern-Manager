using InternManager.Api.Application.Users;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Tests;

public sealed class UsersControllerBehaviorTests
{
    [Fact]
    public async Task GetUsers_AppliesFiltersPaginationAndRejectsInvalidFilters()
    {
        await using var dbContext = TestDbContext.Create();
        var departmentId = Guid.NewGuid();
        dbContext.Departments.Add(new Department { Id = departmentId, Name = "Engineering" });
        dbContext.Users.AddRange(
            TestUsers.Create(Guid.NewGuid(), UserRole.Admin, "admin@example.com"),
            TestUsers.Create(Guid.NewGuid(), UserRole.Intern, "intern@example.com", departmentId: departmentId),
            TestUsers.Create(Guid.NewGuid(), UserRole.Supervisor, "supervisor@example.com", status: UserStatus.Archived));
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, Guid.NewGuid(), UserRole.Admin);

        var filtered = await controller.GetUsers("intern", page: -1, limit: 500, status: "active", department: departmentId.ToString(), cancellationToken: CancellationToken.None);
        var invalidRole = await controller.GetUsers("nope", cancellationToken: CancellationToken.None);
        var invalidStatus = await controller.GetUsers(null, status: "disabled", cancellationToken: CancellationToken.None);
        var invalidDepartment = await controller.GetUsers(null, department: "not-a-guid", cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(filtered);
        Assert.Equal(1, ReadAnonymousProperty(ok.Value, "total"));
        Assert.IsType<BadRequestObjectResult>(invalidRole);
        Assert.IsType<BadRequestObjectResult>(invalidStatus);
        Assert.IsType<BadRequestObjectResult>(invalidDepartment);
    }

    [Fact]
    public async Task CreateUser_RejectsInvalidPayloadsBeforePersistence()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        dbContext.Users.Add(TestUsers.Create(actorId, UserRole.Admin, "admin@example.com"));
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId, UserRole.Admin);

        Assert.IsType<BadRequestObjectResult>(await controller.CreateUser(new UpsertUserRequest { Email = "" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.CreateUser(new UpsertUserRequest { Email = "user@example.com", Role = "Intern" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.CreateUser(new UpsertUserRequest { Email = "user@example.com", Name = "User", Role = "Nope" }, CancellationToken.None));
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(await controller.CreateUser(new UpsertUserRequest
        {
            Email = "root@example.com",
            Name = "Root User",
            Role = "SuperAdmin"
        }, CancellationToken.None)).StatusCode);
        Assert.IsType<BadRequestObjectResult>(await controller.CreateUser(new UpsertUserRequest
        {
            Email = "user@example.com",
            Name = "User",
            Role = "Intern",
            Department = "not-a-guid"
        }, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateUser_UpdatesAllowedFieldsCreatesInternProfileAndAudits()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        dbContext.Departments.Add(new Department { Id = departmentId, Name = "Engineering" });
        dbContext.Users.AddRange(
            TestUsers.Create(actorId, UserRole.SuperAdmin, "superadmin@example.com"),
            TestUsers.Create(userId, UserRole.Manager, "manager@example.com"));
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId, UserRole.SuperAdmin);

        var result = await controller.UpdateUser(userId, new UpsertUserRequest
        {
            Name = "Updated Intern",
            Role = "Intern",
            Status = "active",
            Department = departmentId.ToString()
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("intern", ReadAnonymousProperty(ok.Value, "role"));
        var user = await dbContext.Users.SingleAsync(item => item.Id == userId);
        Assert.Equal(UserRole.Intern, user.Role);
        Assert.Equal(InternVerificationStatus.INCOMPLETE, user.VerificationStatus);
        Assert.True(await dbContext.InternProfiles.AnyAsync(profile => profile.InternId == userId));
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "user.update" && log.Entity!.Contains("internProfile", StringComparison.Ordinal));
    }

    [Fact]
    public async Task UpdateUser_RejectsMissingArchivedForbiddenAndInvalidUpdates()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var superAdminId = Guid.NewGuid();
        var archivedId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(actorId, UserRole.Admin, "admin@example.com"),
            TestUsers.Create(superAdminId, UserRole.SuperAdmin, "root@example.com"),
            TestUsers.Create(archivedId, UserRole.Manager, "archived@example.com", UserStatus.Archived));
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId, UserRole.Admin);

        Assert.IsType<NotFoundObjectResult>(await controller.UpdateUser(Guid.NewGuid(), new UpsertUserRequest(), CancellationToken.None));
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(await controller.UpdateUser(archivedId, new UpsertUserRequest { Name = "New Name" }, CancellationToken.None)).StatusCode);
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(await controller.UpdateUser(superAdminId, new UpsertUserRequest { Role = "SuperAdmin" }, CancellationToken.None)).StatusCode);
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateUser(superAdminId, new UpsertUserRequest { Role = "not-a-role" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateUser(superAdminId, new UpsertUserRequest { Status = "disabled" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateUser(superAdminId, new UpsertUserRequest { Password = "weak" }, CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateUser(superAdminId, new UpsertUserRequest { Department = "not-a-guid" }, CancellationToken.None));
    }

    [Fact]
    public async Task ArchiveDeleteGetAndSummary_ReturnExpectedStatusCodes()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var activeInternId = Guid.NewGuid();
        dbContext.Users.AddRange(
            TestUsers.Create(actorId, UserRole.SuperAdmin, "superadmin@example.com"),
            TestUsers.Create(userId, UserRole.Manager, "manager@example.com"),
            TestUsers.Create(activeInternId, UserRole.Intern, "intern@example.com", verificationStatus: InternVerificationStatus.ACTIVE));
        dbContext.Missions.Add(new Mission
        {
            Id = Guid.NewGuid(),
            SupervisorId = actorId,
            InternId = activeInternId,
            Title = "Active",
            Description = "Active",
            Status = "active",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId, UserRole.SuperAdmin);

        Assert.IsType<NotFoundResult>(await controller.GetUserById(Guid.NewGuid(), CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.GetUserById(userId, CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.GetSummary(CancellationToken.None));
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(await controller.ArchiveUser(activeInternId, CancellationToken.None)).StatusCode);
        Assert.IsType<OkObjectResult>(await controller.ArchiveUser(userId, CancellationToken.None));
        Assert.Equal(UserStatus.Archived, (await dbContext.Users.SingleAsync(user => user.Id == userId)).Status);
        Assert.IsType<NoContentResult>(await controller.DeleteUser(userId, CancellationToken.None));
    }

    private static UsersController CreateController(AppDbContext dbContext, Guid actorId, UserRole actorRole)
    {
        return new UsersController(dbContext, new UserDeletionService(dbContext, new UserDeletionPolicy()))
        {
            ControllerContext = TestUsers.ControllerContext(actorId, actorRole, $"{actorRole.ToString().ToLowerInvariant()}@example.com")
        };
    }

    private static object? ReadAnonymousProperty(object? target, string propertyName)
    {
        return target?.GetType().GetProperty(propertyName)?.GetValue(target);
    }
}
