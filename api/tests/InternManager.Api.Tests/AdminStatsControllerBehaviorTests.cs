using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace InternManager.Api.Tests;

public sealed class AdminStatsControllerBehaviorTests
{
    [Fact]
    public async Task StatsEndpoints_ReturnAggregatesForSeededOperationalData()
    {
        await using var dbContext = TestDbContext.Create();
        var ids = SeedStatsData(dbContext);
        var controller = CreateController(dbContext);

        var interns = AssertOk(await controller.GetInternsCount(CancellationToken.None));
        var supervisors = AssertOk(await controller.GetSupervisorsCountForAdmin(CancellationToken.None));
        var missions = AssertOk(await controller.GetMissionsCount(CancellationToken.None));
        var admins = AssertOk(await controller.GetAdminsCount(CancellationToken.None));
        var activeInternships = AssertOk(await controller.GetActiveInternshipsCount(CancellationToken.None));
        var pendingDeliverables = AssertOk(await controller.GetPendingDeliverablesCount(CancellationToken.None));
        var home = Assert.IsType<HomeStatsResponse>(AssertOk(await controller.GetHomeStats(CancellationToken.None)).Value);

        Assert.Equal(2, ReadAnonymousProperty(interns.Value, "count"));
        Assert.Equal(2, ReadAnonymousProperty(supervisors.Value, "count"));
        Assert.Equal(2, ReadAnonymousProperty(missions.Value, "count"));
        Assert.Equal(1, ReadAnonymousProperty(admins.Value, "count"));
        Assert.Equal(1, ReadAnonymousProperty(activeInternships.Value, "count"));
        Assert.Equal(1, ReadAnonymousProperty(pendingDeliverables.Value, "count"));
        Assert.Equal(2, home.Interns);
        Assert.Equal(2, home.Supervisors);

        var byDepartment = AssertOk(await controller.GetInternsByDepartment(CancellationToken.None));
        var bySchool = AssertOk(await controller.GetInternsBySchool(CancellationToken.None));
        var bySkill = AssertOk(await controller.GetInternsBySkill(CancellationToken.None));
        var byStatus = AssertOk(await controller.GetInternshipsByStatus(CancellationToken.None));
        var byType = AssertOk(await controller.GetInternshipsByType(CancellationToken.None));

        Assert.NotEmpty((IEnumerable<object>)ReadAnonymousProperty(byDepartment.Value, "data")!);
        Assert.NotEmpty((IEnumerable<object>)ReadAnonymousProperty(bySchool.Value, "data")!);
        Assert.NotEmpty((IEnumerable<object>)ReadAnonymousProperty(bySkill.Value, "data")!);
        Assert.NotEmpty((IEnumerable<object>)ReadAnonymousProperty(byStatus.Value, "data")!);
        Assert.NotEmpty((IEnumerable<object>)ReadAnonymousProperty(byType.Value, "data")!);

        Assert.Equal(ids.ActiveMissionId, dbContext.Missions.Single(mission => mission.Id == ids.ActiveMissionId).Id);
    }

    [Fact]
    public async Task BiEndpoints_ReturnDashboardPayloadsAndUseCacheOnRepeatedCalls()
    {
        await using var dbContext = TestDbContext.Create();
        SeedStatsData(dbContext);
        var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = CreateController(dbContext, cache);

        var kpis = AssertOk(await controller.GetBiKpiStats(CancellationToken.None));
        var funnel = AssertOk(await controller.GetBiInternFunnelStats(CancellationToken.None));
        var missions = AssertOk(await controller.GetBiMissionStats(CancellationToken.None));
        var evaluations = AssertOk(await controller.GetBiEvaluationStats(CancellationToken.None));
        var demographics = AssertOk(await controller.GetBiDemographicsStats(CancellationToken.None));
        var workload = AssertOk(await controller.GetBiSupervisorWorkloadStats(CancellationToken.None));
        var deliverables = AssertOk(await controller.GetBiDeliverableStats(CancellationToken.None));
        var health = AssertOk(await controller.GetBiSystemHealthStats(CancellationToken.None));
        var actionQueue = AssertOk(await controller.GetBiActionQueueStats(CancellationToken.None));

        Assert.True((int)ReadAnonymousProperty(kpis.Value, "totalInterns")! >= 2);
        Assert.NotNull(ReadAnonymousProperty(funnel.Value, "funnel"));
        Assert.NotNull(ReadAnonymousProperty(missions.Value, "byStatus"));
        Assert.NotNull(ReadAnonymousProperty(evaluations.Value, "statusCounts"));
        Assert.NotNull(ReadAnonymousProperty(demographics.Value, "byUniversity"));
        Assert.NotNull(ReadAnonymousProperty(workload.Value, "supervisors"));
        Assert.NotNull(ReadAnonymousProperty(deliverables.Value, "byStatus"));
        Assert.NotNull(ReadAnonymousProperty(health.Value, "usersByRole"));
        Assert.NotNull(ReadAnonymousProperty(actionQueue.Value, "items"));

        var cachedKpis = AssertOk(await controller.GetBiKpiStats(CancellationToken.None));
        Assert.Equal(ReadAnonymousProperty(kpis.Value, "totalInterns"), ReadAnonymousProperty(cachedKpis.Value, "totalInterns"));
    }

    private static AdminStatsController CreateController(AppDbContext dbContext, IMemoryCache? cache = null)
    {
        return new AdminStatsController(dbContext, cache ?? new MemoryCache(new MemoryCacheOptions()))
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.Admin, "admin@example.com")
        };
    }

    private static OkObjectResult AssertOk(IActionResult result)
    {
        return Assert.IsType<OkObjectResult>(result);
    }

    private static object? ReadAnonymousProperty(object? target, string propertyName)
    {
        return target?.GetType().GetProperty(propertyName)?.GetValue(target);
    }

    private static SeededStatsIds SeedStatsData(AppDbContext dbContext)
    {
        var now = DateTime.UtcNow;
        var departmentId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        var skillId = Guid.NewGuid();
        var typeId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var coSupervisorId = Guid.NewGuid();
        var activeInternId = Guid.NewGuid();
        var pendingInternId = Guid.NewGuid();
        var activeMissionId = Guid.NewGuid();
        var endingMissionId = Guid.NewGuid();
        var profileId = Guid.NewGuid();

        dbContext.Departments.Add(new Department { Id = departmentId, Name = "Engineering" });
        dbContext.Schools.Add(new School { Id = schoolId, Name = "Axia University" });
        dbContext.Skills.Add(new Skill { Id = skillId, Name = "CSharp" });
        dbContext.InternshipTypes.Add(new InternshipType { Id = typeId, Name = "Summer Internship" });

        dbContext.Users.AddRange(
            TestUsers.Create(adminId, UserRole.Admin, "admin@example.com"),
            TestUsers.Create(supervisorId, UserRole.Supervisor, "supervisor@example.com"),
            TestUsers.Create(coSupervisorId, UserRole.Supervisor, "cosupervisor@example.com"),
            TestUsers.Create(activeInternId, UserRole.Intern, "active.intern@example.com", verificationStatus: InternVerificationStatus.ACTIVE, departmentId: departmentId),
            TestUsers.Create(pendingInternId, UserRole.Intern, "pending.intern@example.com", verificationStatus: InternVerificationStatus.PENDING));

        dbContext.InternProfiles.Add(new InternProfile
        {
            Id = profileId,
            InternId = activeInternId,
            UniversityId = schoolId,
            Major = "Computer Science",
            CurrentYearOfStudy = "2",
            WorkPreference = WorkPreference.Hybrid,
            CvFileUrl = "/uploads/cv.pdf",
            CreatedAt = now.AddMonths(-2),
            UpdatedAt = now.AddMonths(-1)
        });
        dbContext.InternProfileSkills.Add(new InternProfileSkill
        {
            InternProfileId = profileId,
            SkillId = skillId,
            CreatedAt = now.AddMonths(-1)
        });

        dbContext.Missions.AddRange(
            new Mission
            {
                Id = activeMissionId,
                SupervisorId = supervisorId,
                CoSupervisorId = coSupervisorId,
                InternId = activeInternId,
                InternshipTypeId = typeId,
                Title = "Active Mission",
                Description = "Build dashboard",
                Status = DomainStatuses.Mission.Active,
                StartDate = null,
                EndDate = now.AddDays(5),
                CreatedAt = now.AddDays(-20)
            },
            new Mission
            {
                Id = endingMissionId,
                SupervisorId = supervisorId,
                Title = "Template Mission",
                Description = "Template",
                Status = DomainStatuses.Mission.Template,
                CreatedAt = now.AddDays(-5)
            });
        dbContext.MissionInternAssignments.Add(new MissionInternAssignment
        {
            MissionId = activeMissionId,
            InternId = activeInternId,
            AssignedAt = now.AddDays(-9)
        });
        dbContext.MissionHistoryEntries.AddRange(
            new MissionHistoryEntry { MissionId = activeMissionId, Field = "department", NewValue = "Engineering", ChangedBy = "admin", ChangedAt = now.AddDays(-9) },
            new MissionHistoryEntry { MissionId = activeMissionId, Field = "type", NewValue = "Summer Internship", ChangedBy = "admin", ChangedAt = now.AddDays(-9) },
            new MissionHistoryEntry { MissionId = activeMissionId, Field = "endDate", NewValue = now.AddDays(5).ToString("O"), ChangedBy = "admin", ChangedAt = now.AddDays(-9) });

        dbContext.Deliverables.AddRange(
            new Deliverable
            {
                Id = Guid.NewGuid(),
                MissionId = activeMissionId,
                SupervisorId = supervisorId,
                InternId = activeInternId,
                Title = "Pending overdue",
                Status = DomainStatuses.Deliverable.Pending,
                DueDate = now.AddDays(-1),
                Progress = 30,
                CreatedAt = now.AddDays(-8)
            },
            new Deliverable
            {
                Id = Guid.NewGuid(),
                MissionId = activeMissionId,
                SupervisorId = supervisorId,
                InternId = activeInternId,
                Title = "Accepted",
                Status = DomainStatuses.Deliverable.Accepted,
                SubmittedDate = now.AddDays(-2),
                Progress = 100,
                CreatedAt = now.AddDays(-7)
            });

        dbContext.Evaluations.AddRange(
            new Evaluation
            {
                Id = Guid.NewGuid(),
                InternId = activeInternId,
                SupervisorId = supervisorId,
                Type = "mid-term",
                Status = DomainStatuses.Evaluation.Submitted,
                Technical = 8,
                Autonomy = 7,
                Communication = 9,
                DeadlineRespect = 6,
                DeliverableQuality = 10,
                SubmittedAt = now.AddDays(-1),
                CreatedAt = now.AddDays(-3)
            },
            new Evaluation
            {
                Id = Guid.NewGuid(),
                InternId = activeInternId,
                SupervisorId = supervisorId,
                Type = "end",
                Status = DomainStatuses.Evaluation.Pending,
                CreatedAt = now.AddDays(-2)
            });

        dbContext.Meetings.Add(new Meeting
        {
            Id = Guid.NewGuid(),
            InternId = activeInternId,
            SupervisorId = supervisorId,
            Date = now.AddDays(1),
            Notes = "Weekly sync",
            CreatedAt = now.AddDays(-1)
        });
        dbContext.JournalEntries.Add(new JournalEntry
        {
            Id = Guid.NewGuid(),
            InternId = activeInternId,
            Content = "Progress update",
            IsReviewed = false,
            CreatedAt = now.AddDays(-1)
        });
        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = adminId,
            Actor = "admin@example.com",
            Action = "seed",
            Entity = "stats",
            Timestamp = now.AddDays(-1)
        });
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = adminId,
            Token = "token",
            CreatedAt = now,
            ExpiresAt = now.AddDays(1)
        });

        dbContext.SaveChanges();
        return new SeededStatsIds(activeMissionId);
    }

    private sealed record SeededStatsIds(Guid ActiveMissionId);
}
