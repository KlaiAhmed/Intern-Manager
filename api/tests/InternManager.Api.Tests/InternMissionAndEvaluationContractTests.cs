using System.Security.Claims;
using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace InternManager.Api.Tests;

public sealed class InternMissionAndEvaluationContractTests
{
    [Fact]
    public async Task GetMyMissions_ReturnsEmptyMissionsArray_WhenInternHasNoMissions()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();

        dbContext.Users.Add(CreateUser(internId, UserRole.Intern, "Intern", "Empty"));
        await dbContext.SaveChangesAsync();

        var controller = new InternshipController(dbContext)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = CreateHttpContext(internId, UserRole.Intern)
            }
        };

        var result = await controller.GetMyMissions(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternMissionHistoryResponse>(ok.Value);
        Assert.Empty(response.Missions);
    }

    [Fact]
    public async Task GetMyMissions_ReturnsMissionHistory_WithCoSupervisorNameAndProgress()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var coSupervisorId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();
        var typeId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var completedMissionId = Guid.NewGuid();
        var assignedAt = DateTime.UtcNow.AddDays(-5);

        dbContext.Departments.Add(new Department
        {
            Id = departmentId,
            Name = "Engineering",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        dbContext.InternshipTypes.Add(new InternshipType
        {
            Id = typeId,
            Name = "Summer Internship",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        dbContext.Users.AddRange(
            CreateUser(internId, UserRole.Intern, "Amina", "Intern", departmentId),
            CreateUser(supervisorId, UserRole.Supervisor, "Samir", "Supervisor"),
            CreateUser(coSupervisorId, UserRole.Supervisor, "Nadia", "CoSupervisor"));

        dbContext.Missions.AddRange(
            new Mission
            {
                Id = missionId,
                SupervisorId = supervisorId,
                CoSupervisorId = coSupervisorId,
                Title = "AI Mission",
                Description = "Build intern tooling",
                InternshipTypeId = typeId,
                Status = DomainStatuses.Mission.Active,
                StartDate = DateTime.UtcNow.AddDays(-10),
                EndDate = DateTime.UtcNow.AddDays(20),
                CreatedAt = DateTime.UtcNow.AddDays(-15)
            },
            new Mission
            {
                Id = completedMissionId,
                SupervisorId = supervisorId,
                InternId = internId,
                Title = "Completed Mission",
                Description = "Finished work",
                Status = DomainStatuses.Mission.Completed,
                StartDate = DateTime.UtcNow.AddMonths(-3),
                EndDate = DateTime.UtcNow.AddMonths(-1),
                CreatedAt = DateTime.UtcNow.AddMonths(-3)
            });

        dbContext.MissionInternAssignments.Add(new MissionInternAssignment
        {
            MissionId = missionId,
            InternId = internId,
            AssignedAt = assignedAt
        });

        dbContext.Deliverables.AddRange(
            CreateDeliverable(missionId, supervisorId, internId, "First", 50, DomainStatuses.Deliverable.AwaitingReview),
            CreateDeliverable(missionId, supervisorId, internId, "Second", 100, DomainStatuses.Deliverable.Approved));

        await dbContext.SaveChangesAsync();

        var controller = new InternshipController(dbContext)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = CreateHttpContext(internId, UserRole.Intern)
            }
        };

        var result = await controller.GetMyMissions(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternMissionHistoryResponse>(ok.Value);
        Assert.Equal(2, response.Missions.Count);

        var activeMission = Assert.Single(response.Missions, item => item.Id == missionId);
        Assert.Equal("AI Mission", activeMission.MissionTitle);
        Assert.Equal(DomainStatuses.Mission.Active, activeMission.Status);
        Assert.Equal(75, activeMission.Progress);
        Assert.Equal("Samir Supervisor", activeMission.SupervisorName);
        Assert.Equal("Nadia CoSupervisor", activeMission.CoSupervisorName);
        Assert.Equal("Engineering", activeMission.DepartmentName);
        Assert.Equal("Summer Internship", activeMission.Type);
        Assert.Equal(assignedAt, activeMission.AssignedAt);
        Assert.Null(typeof(InternMissionHistoryItemResponse).GetProperty("SupervisorEmail"));
    }

    [Fact]
    public async Task GetMyEvaluations_ReturnsExplicitCriteriaShapeWithoutScores()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var releasedEvaluationId = Guid.NewGuid();

        dbContext.Users.AddRange(
            CreateUser(internId, UserRole.Intern, "Amina", "Intern"),
            CreateUser(supervisorId, UserRole.Supervisor, "Samir", "Supervisor"));

        dbContext.Evaluations.AddRange(
            new Evaluation
            {
                Id = releasedEvaluationId,
                InternId = internId,
                SupervisorId = supervisorId,
                Type = "mid-term",
                Status = DomainStatuses.Evaluation.Submitted,
                Technical = 8,
                Autonomy = 7,
                Communication = 9,
                DeadlineRespect = 6,
                DeliverableQuality = 10,
                Comments = "Strong delivery",
                IsReleasedToIntern = true,
                ReleasedAt = DateTime.UtcNow.AddDays(-1),
                SubmittedAt = DateTime.UtcNow.AddDays(-2),
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            },
            new Evaluation
            {
                Id = Guid.NewGuid(),
                InternId = internId,
                SupervisorId = supervisorId,
                Type = "end",
                Status = DomainStatuses.Evaluation.Submitted,
                IsReleasedToIntern = false,
                CreatedAt = DateTime.UtcNow
            });

        await dbContext.SaveChangesAsync();

        var controller = new EvaluationsController(
            dbContext,
            new EmptySupervisorScopeService(),
            new EmptyEvaluationStatusService(),
            new MissionPolicyService(dbContext))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = CreateHttpContext(internId, UserRole.Intern)
            }
        };

        var result = await controller.GetMyEvaluations(page: 1, pageSize: 20, cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternEvaluationsResponse>(ok.Value);
        var evaluation = Assert.Single(response.Data);

        Assert.Equal(releasedEvaluationId, evaluation.Id);
        Assert.Equal("mid_term", evaluation.Type);
        Assert.Equal(8, evaluation.Criteria.Technical);
        Assert.Equal(7, evaluation.Criteria.Autonomy);
        Assert.Equal(9, evaluation.Criteria.Communication);
        Assert.Equal(6, evaluation.Criteria.DeadlineRespect);
        Assert.Equal(10, evaluation.Criteria.DeliverableQuality);
        Assert.Equal("Samir Supervisor", evaluation.SupervisorName);
        Assert.Null(typeof(InternEvaluationResponse).GetProperty("Scores"));
    }

    [Fact]
    public async Task GetEvaluationById_ReturnsNotFoundForUnreleasedInternEvaluation()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var evaluationId = Guid.NewGuid();

        dbContext.Users.AddRange(
            CreateUser(internId, UserRole.Intern, "Amina", "Intern"),
            CreateUser(supervisorId, UserRole.Supervisor, "Samir", "Supervisor"));

        dbContext.Evaluations.Add(new Evaluation
        {
            Id = evaluationId,
            InternId = internId,
            SupervisorId = supervisorId,
            Type = "mid-term",
            Status = DomainStatuses.Evaluation.Submitted,
            IsReleasedToIntern = false,
            CreatedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();

        var controller = new EvaluationsController(
            dbContext,
            new EmptySupervisorScopeService(),
            new EmptyEvaluationStatusService(),
            new MissionPolicyService(dbContext))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = CreateHttpContext(internId, UserRole.Intern)
            }
        };

        var result = await controller.GetEvaluationById(evaluationId, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetEvaluationById_RawSerializedJsonDoesNotIncludePrivateNotesForInterns()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var evaluationId = Guid.NewGuid();

        dbContext.Users.AddRange(
            CreateUser(internId, UserRole.Intern, "Amina", "Intern"),
            CreateUser(supervisorId, UserRole.Supervisor, "Samir", "Supervisor"));

        dbContext.Evaluations.Add(new Evaluation
        {
            Id = evaluationId,
            InternId = internId,
            SupervisorId = supervisorId,
            Type = "mid-term",
            Status = DomainStatuses.Evaluation.Submitted,
            IsReleasedToIntern = true,
            ReleasedAt = DateTime.UtcNow.AddDays(-1),
            Technical = 9,
            Autonomy = 8,
            Communication = 7,
            DeadlineRespect = 10,
            DeliverableQuality = 9,
            Comments = "Solid work",
            OverallScore = 9.0m,
            PrivateNotes = "Internal only",
            CreatedAt = DateTime.UtcNow.AddDays(-5)
        });

        await dbContext.SaveChangesAsync();

        var controller = new EvaluationsController(
            dbContext,
            new EmptySupervisorScopeService(),
            new EmptyEvaluationStatusService(),
            new MissionPolicyService(dbContext))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = CreateHttpContext(internId, UserRole.Intern)
            }
        };

        var result = await controller.GetEvaluationById(evaluationId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.DoesNotContain("privateNotes", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"comments\":\"Solid work\"", json, StringComparison.OrdinalIgnoreCase);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static DefaultHttpContext CreateHttpContext(Guid userId, UserRole role)
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(
            new ClaimsIdentity(
            [
                new Claim("userId", userId.ToString()),
                new Claim("email", "user@example.com"),
                new Claim(ClaimTypes.Role, role.ToString())
            ],
            "TestAuth"));

        return context;
    }

    private static User CreateUser(
        Guid id,
        UserRole role,
        string firstName,
        string lastName,
        Guid? departmentId = null)
    {
        return new User
        {
            Id = id,
            FirstName = firstName,
            LastName = lastName,
            Email = $"{firstName}.{lastName}.{id:N}@example.com".ToLowerInvariant(),
            PasswordHash = "hash",
            Role = role,
            Status = UserStatus.Active,
            VerificationStatus = role == UserRole.Intern
                ? InternVerificationStatus.ACTIVE
                : InternVerificationStatus.NOT_APPLICABLE,
            DepartmentId = departmentId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static Deliverable CreateDeliverable(
        Guid missionId,
        Guid supervisorId,
        Guid internId,
        string title,
        int progress,
        string status)
    {
        return new Deliverable
        {
            Id = Guid.NewGuid(),
            MissionId = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = title,
            Status = status,
            RawProgress = progress,
            CreatedAt = DateTime.UtcNow
        };
    }

    private sealed class EmptySupervisorScopeService : ISupervisorScopeService
    {
        public Task<IReadOnlySet<Guid>> GetAssignedInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlySet<Guid>>(new HashSet<Guid>());
        }
    }

    private sealed class EmptyEvaluationStatusService : IEvaluationStatusService
    {
        public Task<EvaluationStatusResponse> GetSupervisorEvaluationStatusAsync(
            Guid supervisorId,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new EvaluationStatusResponse());
        }
    }
}
