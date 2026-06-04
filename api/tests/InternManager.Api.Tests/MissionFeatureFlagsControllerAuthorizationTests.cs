using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace InternManager.Api.Tests;

/// <summary>
/// Tests for the supervisor-side authorization on the mission feature-flag
/// endpoints. The original controller was restricted to Admin/SuperAdmin,
/// which the supervisor dashboard's feature-flag panel could not satisfy.
/// </summary>
public sealed class MissionFeatureFlagsControllerAuthorizationTests
{
    [Fact]
    public async Task GetMissionFeatureFlags_AllowsOwningSupervisorAndForbidsUnrelatedSupervisor()
    {
        var (dbContext, supervisorId, missionId) = await SeedAsync();
        var service = new MissionFeatureFlagsService(new FakeRepository { MissionExists = true }, new MemoryCache(new MemoryCacheOptions()));
        var controller = new MissionFeatureFlagsController(service, dbContext)
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };

        var ok = await controller.Get(missionId, CancellationToken.None);
        Assert.IsType<OkObjectResult>(ok);

        var unrelated = new MissionFeatureFlagsController(service, dbContext)
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.Supervisor)
        };
        var forbid = await unrelated.Get(missionId, CancellationToken.None);
        Assert.IsType<ForbidResult>(forbid);
    }

    [Fact]
    public async Task PutMissionFeatureFlags_AllowsOwningSupervisorAndForbidsUnrelatedSupervisor()
    {
        var (dbContext, supervisorId, missionId) = await SeedAsync();
        var service = new MissionFeatureFlagsService(new FakeRepository { MissionExists = true }, new MemoryCache(new MemoryCacheOptions()));

        var owningController = new MissionFeatureFlagsController(service, dbContext)
        {
            ControllerContext = TestUsers.ControllerContext(supervisorId, UserRole.Supervisor)
        };
        var config = MissionCardConfigDefaults.Create();
        var ok = await owningController.Put(missionId, config, CancellationToken.None);
        Assert.IsType<OkObjectResult>(ok);

        var unrelated = new MissionFeatureFlagsController(service, dbContext)
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.Supervisor)
        };
        var forbid = await unrelated.Put(missionId, config, CancellationToken.None);
        Assert.IsType<ForbidResult>(forbid);
    }

    [Fact]
    public async Task GetMissionFeatureFlags_AllowsAdminScopeEvenWithoutMissionOwnership()
    {
        var (dbContext, _, missionId) = await SeedAsync();
        var service = new MissionFeatureFlagsService(new FakeRepository { MissionExists = true }, new MemoryCache(new MemoryCacheOptions()));
        var adminController = new MissionFeatureFlagsController(service, dbContext)
        {
            ControllerContext = TestUsers.ControllerContext(Guid.NewGuid(), UserRole.SuperAdmin)
        };

        var result = await adminController.Get(missionId, CancellationToken.None);
        Assert.IsType<OkObjectResult>(result);
    }

    private static async Task<(AppDbContext DbContext, Guid SupervisorId, Guid MissionId)> SeedAsync()
    {
        var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();

        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            Title = "Feature flag mission",
            Description = "x",
            SkillsJson = "[]",
            Status = DomainStatuses.Mission.Active,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        return (dbContext, supervisorId, missionId);
    }

    private sealed class FakeRepository : IMissionFeatureFlagsRepository
    {
        public bool MissionExists { get; set; }
        public MissionFeatureFlags? Stored { get; set; }

        public int AddCalls { get; private set; }
        public int SaveChangesCalls { get; private set; }
        public int GetByMissionIdCalls { get; private set; }

        public Task<bool> MissionExistsAsync(Guid missionId, CancellationToken cancellationToken) =>
            Task.FromResult(MissionExists);

        public Task<MissionFeatureFlags?> GetByMissionIdAsync(Guid missionId, CancellationToken cancellationToken)
        {
            GetByMissionIdCalls++;
            return Task.FromResult(Stored);
        }

        public void Add(MissionFeatureFlags entity) => AddCalls++;

        public void Update(MissionFeatureFlags entity) { }

        public void AddHistoryEntries(IEnumerable<MissionHistoryEntry> entries) { }

        public void AddAuditLog(AuditLog log) { }

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls++;
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<Guid>> GetInternIdsForMissionAsync(Guid missionId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Guid>>([]);

        public Task<IReadOnlyList<MissionHistoryEntry>> GetFeatureFlagHistoryAsync(Guid missionId, int take, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MissionHistoryEntry>>([]);

        public void AddInternNotifications(IEnumerable<InternNotification> notifications) { }

        public Task<Guid?> GetActiveMissionIdForInternAsync(Guid internId, CancellationToken cancellationToken) =>
            Task.FromResult<Guid?>(null);
    }
}
