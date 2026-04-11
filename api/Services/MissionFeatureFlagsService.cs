using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace InternManager.Api.Services;

/// <summary>
/// Service métier des drapeaux de fonctionnalité dashboard.
/// </summary>
public sealed class MissionFeatureFlagsService(
    IMissionFeatureFlagsRepository repository,
    IMemoryCache memoryCache) : IMissionFeatureFlagsService
{
    private const string CacheKeyPrefix = "mission-feature-flags:";

    /// <inheritdoc />
    public async Task<MissionCardConfig> GetMissionConfigAsync(Guid missionId, CancellationToken cancellationToken)
    {
        if (!await repository.MissionExistsAsync(missionId, cancellationToken))
        {
            throw new KeyNotFoundException("Mission not found.");
        }

        var cacheKey = BuildCacheKey(missionId);
        if (memoryCache.TryGetValue(cacheKey, out MissionCardConfig? cachedConfig) && cachedConfig is not null)
        {
            return MissionCardConfigJson.Clone(cachedConfig);
        }

        var storedConfig = await GetOrCreateMissionConfigEntityAsync(missionId, cancellationToken);
        var clonedConfig = MissionCardConfigJson.Clone(storedConfig.MissionCardConfig);

        memoryCache.Set(cacheKey, MissionCardConfigJson.Clone(clonedConfig), new MemoryCacheEntryOptions
        {
            SlidingExpiration = TimeSpan.FromSeconds(60)
        });

        return clonedConfig;
    }

    /// <inheritdoc />
    public async Task<MissionCardConfig> UpdateMissionConfigAsync(
        Guid missionId,
        MissionCardConfig updatedConfig,
        Guid actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken)
    {
        if (!await repository.MissionExistsAsync(missionId, cancellationToken))
        {
            throw new KeyNotFoundException("Mission not found.");
        }

        var now = DateTime.UtcNow;
        var storedEntity = await repository.GetByMissionIdAsync(missionId, cancellationToken);
        var isNewEntity = storedEntity is null;

        var missionFeatureFlags = storedEntity ?? new MissionFeatureFlags
        {
            MissionId = missionId,
            MissionCardConfig = MissionCardConfigDefaults.Create(),
            CreatedAt = now,
            UpdatedAt = now,
            UpdatedByUserId = actorUserId
        };

        var previousConfig = MissionCardConfigJson.Clone(missionFeatureFlags.MissionCardConfig);
        var nextConfig = MissionCardConfigJson.Clone(updatedConfig);

        if (string.Equals(
                MissionCardConfigJson.Serialize(previousConfig),
                MissionCardConfigJson.Serialize(nextConfig),
                StringComparison.Ordinal))
        {
            return previousConfig;
        }

        missionFeatureFlags.MissionCardConfig = nextConfig;
        missionFeatureFlags.UpdatedAt = now;
        missionFeatureFlags.UpdatedByUserId = actorUserId;

        var historyEntries = BuildHistoryEntries(
            missionId,
            actorUserId,
            actorDisplayName,
            now,
            previousConfig,
            nextConfig);

        if (isNewEntity)
        {
            repository.Add(missionFeatureFlags);
        }
        else
        {
            repository.Update(missionFeatureFlags);
        }

        repository.AddHistoryEntries(historyEntries);
        repository.AddAuditLog(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorDisplayName,
            Action = "mission.featureflags.update",
            Entity = $"mission:{missionId}",
            Timestamp = now
        });

        await repository.SaveChangesAsync(cancellationToken);

        var internIds = await repository.GetInternIdsForMissionAsync(missionId, cancellationToken);
        if (internIds.Count > 0)
        {
            repository.AddInternNotifications(internIds.Select(internId => new InternNotification
            {
                InternId = internId,
                Type = InternNotificationType.FeatureFlagChanged,
                Message = "Your dashboard access has been updated for the current mission.",
                RelatedEntityId = missionFeatureFlags.MissionFeatureFlagsId,
                IsRead = false,
                CreatedAt = now
            }));

            await repository.SaveChangesAsync(cancellationToken);
        }

        InvalidateMissionCache(missionId);
        return MissionCardConfigJson.Clone(nextConfig);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<MissionFeatureFlagHistoryItemResponse>> GetHistoryAsync(
        Guid missionId,
        int take,
        CancellationToken cancellationToken)
    {
        if (!await repository.MissionExistsAsync(missionId, cancellationToken))
        {
            throw new KeyNotFoundException("Mission not found.");
        }

        var entries = await repository.GetFeatureFlagHistoryAsync(missionId, take, cancellationToken);

        return entries
            .Where(entry => !string.Equals(entry.Field, "featureFlags.snapshot", StringComparison.Ordinal))
            .Select(MapHistoryEntry)
            .ToList();
    }

    /// <inheritdoc />
    public async Task<MissionCardConfig?> GetActiveMissionConfigForInternAsync(Guid internId, CancellationToken cancellationToken)
    {
        var missionId = await repository.GetActiveMissionIdForInternAsync(internId, cancellationToken);
        if (!missionId.HasValue)
        {
            return null;
        }

        return await GetMissionConfigAsync(missionId.Value, cancellationToken);
    }

    /// <inheritdoc />
    public CardConfig ResolveCardConfig(MissionCardConfig missionCardConfig, DashboardCard dashboardCard)
    {
        return dashboardCard switch
        {
            DashboardCard.MissionOverview => missionCardConfig.MissionOverview,
            DashboardCard.QuickStats => missionCardConfig.QuickStats,
            DashboardCard.Tasks => missionCardConfig.Tasks,
            DashboardCard.Deliverables => missionCardConfig.Deliverables,
            DashboardCard.Evaluation => missionCardConfig.Evaluation,
            DashboardCard.Journal => missionCardConfig.Journal,
            DashboardCard.Meeting => missionCardConfig.Meeting,
            _ => missionCardConfig.MissionOverview
        };
    }

    /// <inheritdoc />
    public void InvalidateMissionCache(Guid missionId)
    {
        memoryCache.Remove(BuildCacheKey(missionId));
    }

    private static MissionFeatureFlagHistoryItemResponse MapHistoryEntry(MissionHistoryEntry entry)
    {
        var card = string.Empty;
        var field = entry.Field;

        var segments = entry.Field.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length >= 3)
        {
            card = segments[1];
            field = segments[2];
        }

        return new MissionFeatureFlagHistoryItemResponse
        {
            ChangedByUserId = entry.ChangedByUserId,
            ChangedBy = entry.ChangedBy,
            ChangedAt = entry.ChangedAt,
            Card = card,
            Field = field,
            OldValue = entry.OldValue,
            NewValue = entry.NewValue
        };
    }

    private async Task<MissionFeatureFlags> GetOrCreateMissionConfigEntityAsync(Guid missionId, CancellationToken cancellationToken)
    {
        var stored = await repository.GetByMissionIdAsync(missionId, cancellationToken);
        if (stored is not null)
        {
            return stored;
        }

        var created = new MissionFeatureFlags
        {
            MissionId = missionId,
            MissionCardConfig = MissionCardConfigDefaults.Create(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            UpdatedByUserId = null
        };

        repository.Add(created);
        await repository.SaveChangesAsync(cancellationToken);

        return created;
    }

    private static List<MissionHistoryEntry> BuildHistoryEntries(
        Guid missionId,
        Guid actorUserId,
        string actorDisplayName,
        DateTime now,
        MissionCardConfig oldConfig,
        MissionCardConfig newConfig)
    {
        var entries = new List<MissionHistoryEntry>
        {
            CreateHistoryEntry(
                missionId,
                actorUserId,
                actorDisplayName,
                now,
                "featureFlags.snapshot",
                MissionCardConfigJson.Serialize(oldConfig),
                MissionCardConfigJson.Serialize(newConfig))
        };

        entries.AddRange(CompareCard("missionOverview", oldConfig.MissionOverview, newConfig.MissionOverview, missionId, actorUserId, actorDisplayName, now));
        entries.AddRange(CompareCard("quickStats", oldConfig.QuickStats, newConfig.QuickStats, missionId, actorUserId, actorDisplayName, now));
        entries.AddRange(CompareCard("tasks", oldConfig.Tasks, newConfig.Tasks, missionId, actorUserId, actorDisplayName, now));
        entries.AddRange(CompareCard("deliverables", oldConfig.Deliverables, newConfig.Deliverables, missionId, actorUserId, actorDisplayName, now));
        entries.AddRange(CompareCard("evaluation", oldConfig.Evaluation, newConfig.Evaluation, missionId, actorUserId, actorDisplayName, now));
        entries.AddRange(CompareCard("journal", oldConfig.Journal, newConfig.Journal, missionId, actorUserId, actorDisplayName, now));
        entries.AddRange(CompareCard("meeting", oldConfig.Meeting, newConfig.Meeting, missionId, actorUserId, actorDisplayName, now));

        return entries;
    }

    private static IEnumerable<MissionHistoryEntry> CompareCard(
        string cardName,
        CardConfig oldCard,
        CardConfig newCard,
        Guid missionId,
        Guid actorUserId,
        string actorDisplayName,
        DateTime now)
    {
        if (oldCard.IsVisible != newCard.IsVisible)
        {
            yield return CreateHistoryEntry(
                missionId,
                actorUserId,
                actorDisplayName,
                now,
                $"featureFlags.{cardName}.isVisible",
                oldCard.IsVisible.ToString(),
                newCard.IsVisible.ToString());
        }

        if (oldCard.IsInteractive != newCard.IsInteractive)
        {
            yield return CreateHistoryEntry(
                missionId,
                actorUserId,
                actorDisplayName,
                now,
                $"featureFlags.{cardName}.isInteractive",
                oldCard.IsInteractive.ToString(),
                newCard.IsInteractive.ToString());
        }

        var oldRequirement = oldCard.RequirementConfig?.RootElement.GetRawText() ?? "null";
        var newRequirement = newCard.RequirementConfig?.RootElement.GetRawText() ?? "null";

        if (!string.Equals(oldRequirement, newRequirement, StringComparison.Ordinal))
        {
            yield return CreateHistoryEntry(
                missionId,
                actorUserId,
                actorDisplayName,
                now,
                $"featureFlags.{cardName}.requirementConfig",
                oldRequirement,
                newRequirement);
        }
    }

    private static MissionHistoryEntry CreateHistoryEntry(
        Guid missionId,
        Guid actorUserId,
        string actorDisplayName,
        DateTime changedAt,
        string field,
        string? oldValue,
        string? newValue)
    {
        return new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = missionId,
            Field = field,
            OldValue = oldValue,
            NewValue = newValue,
            ChangedByUserId = actorUserId,
            ChangedBy = actorDisplayName,
            ChangedAt = changedAt
        };
    }

    private static string BuildCacheKey(Guid missionId)
    {
        return $"{CacheKeyPrefix}{missionId:D}";
    }
}
