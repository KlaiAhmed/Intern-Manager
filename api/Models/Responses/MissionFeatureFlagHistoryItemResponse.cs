namespace InternManager.Api.Models.Responses;

/// <summary>
/// Représente une ligne d historique de changement de configuration des cartes dashboard d une mission.
/// </summary>
public sealed class MissionFeatureFlagHistoryItemResponse
{
    public Guid? ChangedByUserId { get; init; }

    public string ChangedBy { get; init; } = string.Empty;

    public DateTime ChangedAt { get; init; }

    public string Card { get; init; } = string.Empty;

    public string Field { get; init; } = string.Empty;

    public string? OldValue { get; init; }

    public string? NewValue { get; init; }
}
