using InternManager.Api.Common.Enums;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Service métier des drapeaux de fonctionnalité dashboard par mission.
/// </summary>
public interface IMissionFeatureFlagsService
{
    /// <summary>
    /// Retourne la configuration d une mission (créée par défaut si absente).
    /// </summary>
    Task<MissionCardConfig> GetMissionConfigAsync(Guid missionId, CancellationToken cancellationToken);

    /// <summary>
    /// Met à jour la configuration d une mission et publie l historique des changements.
    /// </summary>
    Task<MissionCardConfig> UpdateMissionConfigAsync(
        Guid missionId,
        MissionCardConfig updatedConfig,
        Guid actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken);

    /// <summary>
    /// Retourne l historique récent des changements de feature flags d une mission.
    /// </summary>
    Task<IReadOnlyList<MissionFeatureFlagHistoryItemResponse>> GetHistoryAsync(
        Guid missionId,
        int take,
        CancellationToken cancellationToken);

    /// <summary>
    /// Retourne la configuration de la mission active d un intern.
    /// </summary>
    Task<MissionCardConfig?> GetActiveMissionConfigForInternAsync(Guid internId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne la configuration d une carte.
    /// </summary>
    CardConfig ResolveCardConfig(MissionCardConfig missionCardConfig, DashboardCard dashboardCard);

    /// <summary>
    /// Invalide le cache de configuration d une mission.
    /// </summary>
    void InvalidateMissionCache(Guid missionId);
}
