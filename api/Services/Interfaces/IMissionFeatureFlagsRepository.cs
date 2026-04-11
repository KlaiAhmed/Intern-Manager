using InternManager.Api.Models.Entities;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Accès aux données des drapeaux de fonctionnalité dashboard par mission.
/// </summary>
public interface IMissionFeatureFlagsRepository
{
    /// <summary>
    /// Retourne la configuration de cartes d une mission.
    /// </summary>
    Task<MissionFeatureFlags?> GetByMissionIdAsync(Guid missionId, CancellationToken cancellationToken);

    /// <summary>
    /// Vérifie l existence d une mission.
    /// </summary>
    Task<bool> MissionExistsAsync(Guid missionId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne la mission active de l intern connecté.
    /// </summary>
    Task<Guid?> GetActiveMissionIdForInternAsync(Guid internId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne les identifiants des internes rattachés à la mission.
    /// </summary>
    Task<IReadOnlyList<Guid>> GetInternIdsForMissionAsync(Guid missionId, CancellationToken cancellationToken);

    /// <summary>
    /// Retourne les entrées d historique de feature flags d une mission.
    /// </summary>
    Task<IReadOnlyList<MissionHistoryEntry>> GetFeatureFlagHistoryAsync(Guid missionId, int take, CancellationToken cancellationToken);

    /// <summary>
    /// Ajoute une configuration de feature flags.
    /// </summary>
    void Add(MissionFeatureFlags missionFeatureFlags);

    /// <summary>
    /// Marque une configuration de feature flags comme mise à jour.
    /// </summary>
    void Update(MissionFeatureFlags missionFeatureFlags);

    /// <summary>
    /// Ajoute des entrées d historique.
    /// </summary>
    void AddHistoryEntries(IEnumerable<MissionHistoryEntry> historyEntries);

    /// <summary>
    /// Ajoute une entrée d audit log.
    /// </summary>
    void AddAuditLog(AuditLog auditLog);

    /// <summary>
    /// Ajoute des notifications intern liées aux feature flags.
    /// </summary>
    void AddInternNotifications(IEnumerable<InternNotification> notifications);

    /// <summary>
    /// Persiste les changements.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
