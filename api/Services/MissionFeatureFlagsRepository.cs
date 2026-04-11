using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

/// <summary>
/// Dépôt EF Core pour les drapeaux de fonctionnalité dashboard.
/// </summary>
public sealed class MissionFeatureFlagsRepository(AppDbContext dbContext) : IMissionFeatureFlagsRepository
{
    /// <inheritdoc />
    public Task<MissionFeatureFlags?> GetByMissionIdAsync(Guid missionId, CancellationToken cancellationToken)
    {
        return dbContext.MissionFeatureFlags
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.MissionId == missionId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<bool> MissionExistsAsync(Guid missionId, CancellationToken cancellationToken)
    {
        return dbContext.Missions
            .AsNoTracking()
            .AnyAsync(item => item.Id == missionId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Guid?> GetActiveMissionIdForInternAsync(Guid internId, CancellationToken cancellationToken)
    {
        var missionId = await dbContext.Missions
            .AsNoTracking()
            .Where(item => item.InternId == internId && item.Status == DomainStatuses.Mission.Active)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        return missionId == Guid.Empty ? null : missionId;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Guid>> GetInternIdsForMissionAsync(Guid missionId, CancellationToken cancellationToken)
    {
        return await dbContext.Missions
            .AsNoTracking()
            .Where(item => item.Id == missionId && item.InternId.HasValue)
            .Select(item => item.InternId!.Value)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<MissionHistoryEntry>> GetFeatureFlagHistoryAsync(Guid missionId, int take, CancellationToken cancellationToken)
    {
        var safeTake = Math.Clamp(take, 1, 100);

        return await dbContext.MissionHistoryEntries
            .AsNoTracking()
            .Where(item => item.MissionId == missionId && item.Field.StartsWith("featureFlags."))
            .OrderByDescending(item => item.ChangedAt)
            .Take(safeTake)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public void Add(MissionFeatureFlags missionFeatureFlags)
    {
        dbContext.MissionFeatureFlags.Add(missionFeatureFlags);
    }

    /// <inheritdoc />
    public void Update(MissionFeatureFlags missionFeatureFlags)
    {
        dbContext.MissionFeatureFlags.Update(missionFeatureFlags);
    }

    /// <inheritdoc />
    public void AddHistoryEntries(IEnumerable<MissionHistoryEntry> historyEntries)
    {
        dbContext.MissionHistoryEntries.AddRange(historyEntries);
    }

    /// <inheritdoc />
    public void AddAuditLog(AuditLog auditLog)
    {
        dbContext.AuditLogs.Add(auditLog);
    }

    /// <inheritdoc />
    public void AddInternNotifications(IEnumerable<InternNotification> notifications)
    {
        dbContext.InternNotifications.AddRange(notifications);
    }

    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
