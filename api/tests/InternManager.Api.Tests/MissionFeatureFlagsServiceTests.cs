using System.Text.Json;
using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace InternManager.Api.Tests;

public sealed class MissionFeatureFlagsServiceTests
{
    [Fact]
    public async Task GetMissionConfigAsync_ThrowsWhenMissionDoesNotExist()
    {
        var service = new MissionFeatureFlagsService(new FakeRepository { MissionExists = false }, new MemoryCache(new MemoryCacheOptions()));

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.GetMissionConfigAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task GetMissionConfigAsync_CreatesDefaultConfigAndReturnsClonesFromCache()
    {
        var missionId = Guid.NewGuid();
        var repository = new FakeRepository { MissionExists = true };
        var service = new MissionFeatureFlagsService(repository, new MemoryCache(new MemoryCacheOptions()));

        var first = await service.GetMissionConfigAsync(missionId, CancellationToken.None);
        var second = await service.GetMissionConfigAsync(missionId, CancellationToken.None);

        Assert.True(first.Tasks.IsVisible);
        Assert.True(second.Tasks.IsInteractive);
        Assert.NotSame(first, second);
        Assert.Equal(1, repository.AddCalls);
        Assert.Equal(1, repository.SaveChangesCalls);
        Assert.Equal(1, repository.GetByMissionIdCalls);
    }

    [Fact]
    public async Task UpdateMissionConfigAsync_NoChange_ReturnsExistingConfigWithoutSideEffects()
    {
        var missionId = Guid.NewGuid();
        var existing = MissionCardConfigDefaults.Create();
        var repository = new FakeRepository
        {
            MissionExists = true,
            Stored = new MissionFeatureFlags
            {
                MissionId = missionId,
                MissionCardConfig = existing
            }
        };
        var service = new MissionFeatureFlagsService(repository, new MemoryCache(new MemoryCacheOptions()));

        var result = await service.UpdateMissionConfigAsync(
            missionId,
            MissionCardConfigJson.Clone(existing),
            Guid.NewGuid(),
            "admin@example.com",
            CancellationToken.None);

        Assert.True(result.Tasks.IsVisible);
        Assert.Equal(0, repository.UpdateCalls);
        Assert.Equal(0, repository.SaveChangesCalls);
        Assert.Empty(repository.HistoryEntries);
        Assert.Empty(repository.AuditLogs);
    }

    [Fact]
    public async Task UpdateMissionConfigAsync_RecordsFieldHistoryAuditAndInternNotifications()
    {
        var missionId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var internIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var repository = new FakeRepository
        {
            MissionExists = true,
            InternIds = internIds,
            Stored = new MissionFeatureFlags
            {
                MissionFeatureFlagsId = 42,
                MissionId = missionId,
                MissionCardConfig = MissionCardConfigDefaults.Create()
            }
        };
        var service = new MissionFeatureFlagsService(repository, new MemoryCache(new MemoryCacheOptions()));
        using var requirement = JsonDocument.Parse("""{"minProgress":80}""");
        var updated = MissionCardConfigDefaults.Create() with
        {
            Tasks = new CardConfig(false, true, requirement),
            Meeting = new CardConfig(true, false, null)
        };

        var result = await service.UpdateMissionConfigAsync(
            missionId,
            updated,
            actorId,
            "admin@example.com",
            CancellationToken.None);

        Assert.False(result.Tasks.IsVisible);
        Assert.False(result.Meeting.IsInteractive);
        Assert.Equal(1, repository.UpdateCalls);
        Assert.Equal(2, repository.SaveChangesCalls);
        Assert.Contains(repository.HistoryEntries, entry => entry.Field == "featureFlags.snapshot");
        Assert.Contains(repository.HistoryEntries, entry => entry.Field == "featureFlags.tasks.isVisible");
        Assert.Contains(repository.HistoryEntries, entry => entry.Field == "featureFlags.tasks.requirementConfig");
        Assert.Contains(repository.HistoryEntries, entry => entry.Field == "featureFlags.meeting.isInteractive");
        Assert.Contains(repository.AuditLogs, log => log.Action == "mission.featureflags.update" && log.Actor == "admin@example.com");
        Assert.Equal(internIds.Length, repository.InternNotifications.Count);
        Assert.All(repository.InternNotifications, notification =>
        {
            Assert.Equal(InternNotificationType.FeatureFlagChanged, notification.Type);
            Assert.False(notification.IsRead);
        });
    }

    [Fact]
    public async Task GetHistoryAsync_FiltersSnapshotsAndMapsCardSegments()
    {
        var missionId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var repository = new FakeRepository
        {
            MissionExists = true,
            History =
            [
                new MissionHistoryEntry
                {
                    MissionId = missionId,
                    Field = "featureFlags.snapshot",
                    ChangedByUserId = actorId,
                    ChangedBy = "admin",
                    ChangedAt = DateTime.UtcNow
                },
                new MissionHistoryEntry
                {
                    MissionId = missionId,
                    Field = "featureFlags.tasks.isVisible",
                    OldValue = "True",
                    NewValue = "False",
                    ChangedByUserId = actorId,
                    ChangedBy = "admin",
                    ChangedAt = DateTime.UtcNow
                },
                new MissionHistoryEntry
                {
                    MissionId = missionId,
                    Field = "legacyField",
                    OldValue = "old",
                    NewValue = "new",
                    ChangedBy = "system",
                    ChangedAt = DateTime.UtcNow
                }
            ]
        };
        var service = new MissionFeatureFlagsService(repository, new MemoryCache(new MemoryCacheOptions()));

        var result = await service.GetHistoryAsync(missionId, take: 20, CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, item => item.Card == "tasks" && item.Field == "isVisible");
        Assert.Contains(result, item => item.Card == string.Empty && item.Field == "legacyField");
    }

    [Fact]
    public async Task GetActiveMissionConfigForInternAsync_ReturnsNullWithoutActiveMission()
    {
        var service = new MissionFeatureFlagsService(new FakeRepository { ActiveMissionId = null }, new MemoryCache(new MemoryCacheOptions()));

        var result = await service.GetActiveMissionConfigForInternAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Null(result);
    }

    [Theory]
    [InlineData(DashboardCard.MissionOverview)]
    [InlineData(DashboardCard.QuickStats)]
    [InlineData(DashboardCard.Tasks)]
    [InlineData(DashboardCard.Deliverables)]
    [InlineData(DashboardCard.Evaluation)]
    [InlineData(DashboardCard.Journal)]
    [InlineData(DashboardCard.Meeting)]
    public void ResolveCardConfig_ReturnsRequestedCard(DashboardCard card)
    {
        var config = new MissionCardConfig(
            new CardConfig(true, true, null),
            new CardConfig(false, true, null),
            new CardConfig(true, false, null),
            new CardConfig(false, false, null),
            new CardConfig(true, true, JsonDocument.Parse("""{"name":"evaluation"}""")),
            new CardConfig(true, true, JsonDocument.Parse("""{"name":"journal"}""")),
            new CardConfig(true, true, JsonDocument.Parse("""{"name":"meeting"}""")));
        var service = new MissionFeatureFlagsService(new FakeRepository(), new MemoryCache(new MemoryCacheOptions()));

        var result = service.ResolveCardConfig(config, card);

        Assert.Same(card switch
        {
            DashboardCard.MissionOverview => config.MissionOverview,
            DashboardCard.QuickStats => config.QuickStats,
            DashboardCard.Tasks => config.Tasks,
            DashboardCard.Deliverables => config.Deliverables,
            DashboardCard.Evaluation => config.Evaluation,
            DashboardCard.Journal => config.Journal,
            DashboardCard.Meeting => config.Meeting,
            _ => config.MissionOverview
        }, result);
    }

    private sealed class FakeRepository : IMissionFeatureFlagsRepository
    {
        public bool MissionExists { get; init; } = true;

        public Guid? ActiveMissionId { get; init; }

        public MissionFeatureFlags? Stored { get; set; }

        public IReadOnlyList<Guid> InternIds { get; init; } = [];

        public IReadOnlyList<MissionHistoryEntry> History { get; init; } = [];

        public List<MissionHistoryEntry> HistoryEntries { get; } = [];

        public List<AuditLog> AuditLogs { get; } = [];

        public List<InternNotification> InternNotifications { get; } = [];

        public int AddCalls { get; private set; }

        public int UpdateCalls { get; private set; }

        public int SaveChangesCalls { get; private set; }

        public int GetByMissionIdCalls { get; private set; }

        public Task<MissionFeatureFlags?> GetByMissionIdAsync(Guid missionId, CancellationToken cancellationToken)
        {
            GetByMissionIdCalls += 1;
            return Task.FromResult(Stored);
        }

        public Task<bool> MissionExistsAsync(Guid missionId, CancellationToken cancellationToken)
        {
            return Task.FromResult(MissionExists);
        }

        public Task<Guid?> GetActiveMissionIdForInternAsync(Guid internId, CancellationToken cancellationToken)
        {
            return Task.FromResult(ActiveMissionId);
        }

        public Task<IReadOnlyList<Guid>> GetInternIdsForMissionAsync(Guid missionId, CancellationToken cancellationToken)
        {
            return Task.FromResult(InternIds);
        }

        public Task<IReadOnlyList<MissionHistoryEntry>> GetFeatureFlagHistoryAsync(Guid missionId, int take, CancellationToken cancellationToken)
        {
            return Task.FromResult(History);
        }

        public void Add(MissionFeatureFlags missionFeatureFlags)
        {
            AddCalls += 1;
            Stored = missionFeatureFlags;
        }

        public void Update(MissionFeatureFlags missionFeatureFlags)
        {
            UpdateCalls += 1;
            Stored = missionFeatureFlags;
        }

        public void AddHistoryEntries(IEnumerable<MissionHistoryEntry> historyEntries)
        {
            HistoryEntries.AddRange(historyEntries);
        }

        public void AddAuditLog(AuditLog auditLog)
        {
            AuditLogs.Add(auditLog);
        }

        public void AddInternNotifications(IEnumerable<InternNotification> notifications)
        {
            InternNotifications.AddRange(notifications);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken)
        {
            SaveChangesCalls += 1;
            return Task.CompletedTask;
        }
    }
}
