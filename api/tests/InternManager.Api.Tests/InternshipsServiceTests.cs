using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Services.Internships;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Tests;

public sealed class InternshipsServiceTests
{
    [Fact]
    public async Task CreateAsync_CreatesMissionHistoryAndAuditForAdmin()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var coSupervisorId = Guid.NewGuid();
        var typeId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();
        SeedReferenceData(dbContext, actorId, supervisorId, coSupervisorId, typeId, departmentId);
        await dbContext.SaveChangesAsync();
        var service = CreateService(dbContext, actorId, UserRole.Admin);

        var response = await service.CreateAsync(new CreateInternshipRequest
        {
            MissionName = "AI Enablement",
            SupervisorId = supervisorId.ToString(),
            CoSupervisorId = coSupervisorId.ToString(),
            Department = departmentId.ToString(),
            Type = typeId.ToString(),
            StartDate = DateTime.UtcNow.AddDays(2),
            EndDate = DateTime.UtcNow.AddDays(30),
            Objectives = "  Build internal tools  "
        });

        Assert.Equal("AI Enablement", response.MissionTitle);
        Assert.Equal(supervisorId, response.SupervisorId);
        Assert.Equal(coSupervisorId, response.CoSupervisorId);
        Assert.Equal("Summer Internship", response.Type);
        Assert.Equal(DomainStatuses.Mission.Active, response.Status);
        Assert.Equal("Build internal tools", response.Objectives);
        Assert.Contains(dbContext.MissionHistoryEntries, entry => entry.MissionId == response.Id && entry.Field == "created");
        Assert.Contains(dbContext.MissionHistoryEntries, entry => entry.MissionId == response.Id && entry.Field == "coSupervisorId");
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "internship.create" && log.Actor == "admin@example.com");
    }

    [Fact]
    public async Task CreateAsync_RejectsInvalidPayloadsAndNonAdminCustomTitles()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        SeedReferenceData(dbContext, actorId, supervisorId, coSupervisorId: null, typeId: null, departmentId: null, internId);
        await dbContext.SaveChangesAsync();
        var supervisorService = CreateService(dbContext, actorId, UserRole.Supervisor);

        await Assert.ThrowsAsync<ArgumentException>(() => supervisorService.CreateAsync(null!));
        await Assert.ThrowsAsync<ArgumentException>(() => supervisorService.CreateAsync(new CreateInternshipRequest
        {
            SupervisorId = supervisorId.ToString(),
            StartDate = DateTime.UtcNow.AddDays(-1),
            EndDate = DateTime.UtcNow.AddDays(2)
        }));
        await Assert.ThrowsAsync<ArgumentException>(() => supervisorService.CreateAsync(new CreateInternshipRequest
        {
            SupervisorId = supervisorId.ToString(),
            StartDate = DateTime.UtcNow.AddDays(3),
            EndDate = DateTime.UtcNow.AddDays(2)
        }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => supervisorService.CreateAsync(new CreateInternshipRequest
        {
            MissionName = "Supervisor cannot set this",
            SupervisorId = supervisorId.ToString(),
            StartDate = DateTime.UtcNow.AddDays(2),
            EndDate = DateTime.UtcNow.AddDays(3)
        }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateService(dbContext, actorId, UserRole.Admin).CreateAsync(new CreateInternshipRequest
        {
            SupervisorId = supervisorId.ToString(),
            InternId = internId.ToString(),
            StartDate = DateTime.UtcNow.AddDays(2),
            EndDate = DateTime.UtcNow.AddDays(3)
        }));
    }

    [Fact]
    public async Task GetAllAndGetById_ReturnPagedResponsesWithAssignedInternMetadata()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        SeedReferenceData(dbContext, actorId, supervisorId, coSupervisorId: null, typeId: null, departmentId: null, internId);
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Assigned Mission",
            Description = "Work",
            Status = DomainStatuses.Mission.Active,
            StartDate = DateTime.UtcNow.AddDays(-1),
            EndDate = DateTime.UtcNow.AddDays(10),
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        });
        dbContext.MissionInternAssignments.Add(new MissionInternAssignment
        {
            MissionId = missionId,
            InternId = internId,
            AssignedAt = DateTime.UtcNow
        });
        dbContext.MissionHistoryEntries.Add(new MissionHistoryEntry
        {
            MissionId = missionId,
            Field = "type",
            NewValue = "PFE",
            ChangedBy = "system",
            ChangedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = CreateService(dbContext, actorId, UserRole.Admin);

        var all = await service.GetAllAsync(null, null, supervisorId.ToString(), page: -5, limit: 500);
        var byId = await service.GetByIdAsync(missionId);
        var missing = await service.GetByIdAsync(Guid.NewGuid());

        Assert.Equal(1, all.Page);
        Assert.Equal(100, all.Limit);
        Assert.Equal(1, all.Total);
        Assert.Equal(missionId, Assert.Single(all.Data).Id);
        Assert.NotNull(byId);
        Assert.Equal([internId], byId!.InternIds);
        Assert.Contains("Intern User", byId.InternNames);
        Assert.Equal("PFE", byId.Type);
        Assert.Null(missing);

        await Assert.ThrowsAsync<ArgumentException>(() => service.GetAllAsync(null, null, "not-a-guid", 1, 20));
        await Assert.ThrowsAsync<ArgumentException>(() => service.GetAllAsync("not-a-status", null, null, 1, 20));
    }

    [Fact]
    public async Task UpdateAsync_RecordsChangedFieldsAndRegeneratesTitleWhenManualTitleIsCleared()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var nextSupervisorId = Guid.NewGuid();
        var coSupervisorId = Guid.NewGuid();
        var typeId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        SeedReferenceData(dbContext, actorId, supervisorId, coSupervisorId, typeId, departmentId, internId);
        dbContext.Users.Add(TestUsers.Create(nextSupervisorId, UserRole.Supervisor, "next.supervisor@example.com"));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Manual Mission",
            IsTitleManuallySet = true,
            Description = "Old objectives",
            Status = DomainStatuses.Mission.Active,
            StartDate = DateTime.UtcNow.AddDays(1),
            EndDate = DateTime.UtcNow.AddDays(10),
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = CreateService(dbContext, actorId, UserRole.Admin);

        var response = await service.UpdateAsync(missionId, new UpdateInternshipRequest
        {
            MissionName = "",
            SupervisorId = nextSupervisorId.ToString(),
            CoSupervisorId = coSupervisorId.ToString(),
            DepartmentId = departmentId.ToString(),
            InternshipTypeId = typeId.ToString(),
            Status = DomainStatuses.Mission.Paused,
            StartDate = DateTime.UtcNow.AddDays(2),
            EndDate = DateTime.UtcNow.AddDays(20),
            Objectives = "New objectives"
        });

        Assert.Equal(nextSupervisorId, response.SupervisorId);
        Assert.Equal(coSupervisorId, response.CoSupervisorId);
        Assert.Equal("Summer Internship", response.Type);
        Assert.Equal(DomainStatuses.Mission.Paused, response.Status);
        Assert.Equal("New objectives", response.Objectives);
        Assert.Equal("Summer Internship - Intern User", response.MissionTitle);
        Assert.Contains(dbContext.MissionHistoryEntries, entry => entry.MissionId == missionId && entry.Field == "supervisorId");
        Assert.Contains(dbContext.MissionHistoryEntries, entry => entry.MissionId == missionId && entry.Field == "status");
        Assert.Contains(dbContext.MissionHistoryEntries, entry => entry.MissionId == missionId && entry.Field == "type");
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "internship.update");
    }

    [Fact]
    public async Task UpdateAsync_RejectsMissingInvalidAndForbiddenUpdates()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        SeedReferenceData(dbContext, actorId, supervisorId, coSupervisorId: null, typeId: null, departmentId: null);
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            Title = "Mission",
            Description = "Work",
            Status = DomainStatuses.Mission.Active,
            StartDate = DateTime.UtcNow.AddDays(1),
            EndDate = DateTime.UtcNow.AddDays(10),
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var adminService = CreateService(dbContext, actorId, UserRole.Admin);
        var supervisorService = CreateService(dbContext, actorId, UserRole.Supervisor);

        await Assert.ThrowsAsync<ArgumentException>(() => adminService.UpdateAsync(missionId, null!));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => adminService.UpdateAsync(Guid.NewGuid(), new UpdateInternshipRequest()));
        await Assert.ThrowsAsync<ArgumentException>(() => adminService.UpdateAsync(missionId, new UpdateInternshipRequest { Status = "invalid" }));
        await Assert.ThrowsAsync<ArgumentException>(() => adminService.UpdateAsync(missionId, new UpdateInternshipRequest { Status = DomainStatuses.Mission.Active }));
        await Assert.ThrowsAsync<ArgumentException>(() => adminService.UpdateAsync(missionId, new UpdateInternshipRequest { EndDate = DateTime.UtcNow.AddDays(-1) }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => supervisorService.UpdateAsync(missionId, new UpdateInternshipRequest { MissionName = "Forbidden" }));
    }

    [Fact]
    public async Task DeleteAsync_RejectsMissingAndMissionsWithDeliverablesThenDeletesCleanMission()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var blockedMissionId = Guid.NewGuid();
        var cleanMissionId = Guid.NewGuid();
        SeedReferenceData(dbContext, actorId, supervisorId, coSupervisorId: null, typeId: null, departmentId: null);
        dbContext.Missions.AddRange(
            new Mission { Id = blockedMissionId, SupervisorId = supervisorId, Title = "Blocked", Description = "Blocked", CreatedAt = DateTime.UtcNow },
            new Mission { Id = cleanMissionId, SupervisorId = supervisorId, Title = "Clean", Description = "Clean", CreatedAt = DateTime.UtcNow });
        dbContext.Deliverables.Add(new Deliverable
        {
            Id = Guid.NewGuid(),
            MissionId = blockedMissionId,
            SupervisorId = supervisorId,
            Title = "Deliverable",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = CreateService(dbContext, actorId, UserRole.Admin);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.DeleteAsync(Guid.NewGuid()));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAsync(blockedMissionId));
        await service.DeleteAsync(cleanMissionId);

        Assert.False(await dbContext.Missions.AnyAsync(mission => mission.Id == cleanMissionId));
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "internship.delete");
    }

    private static InternshipsService CreateService(AppDbContext dbContext, Guid actorId, UserRole role)
    {
        return new InternshipsService(
            dbContext,
            new HttpContextAccessor
            {
                HttpContext = TestUsers.HttpContext(actorId, role, $"{role.ToString().ToLowerInvariant()}@example.com")
            });
    }

    private static void SeedReferenceData(
        AppDbContext dbContext,
        Guid actorId,
        Guid supervisorId,
        Guid? coSupervisorId,
        Guid? typeId,
        Guid? departmentId,
        Guid? internId = null)
    {
        dbContext.Users.Add(TestUsers.Create(actorId, UserRole.Admin, "admin@example.com"));
        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor, "supervisor@example.com"));

        if (coSupervisorId.HasValue)
        {
            dbContext.Users.Add(TestUsers.Create(coSupervisorId.Value, UserRole.Supervisor, "cosupervisor@example.com"));
        }

        if (departmentId.HasValue)
        {
            dbContext.Departments.Add(new Department { Id = departmentId.Value, Name = "Engineering" });
        }

        if (typeId.HasValue)
        {
            dbContext.InternshipTypes.Add(new InternshipType { Id = typeId.Value, Name = "Summer Internship" });
        }

        if (internId.HasValue)
        {
            dbContext.Users.Add(TestUsers.Create(internId.Value, UserRole.Intern, "intern@example.com", departmentId: departmentId));
        }
    }
}
