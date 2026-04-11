namespace InternManager.Api.Models.Entities;

/// <summary>
/// Représente une entrée d audit lisible par les dashboards administratifs.
/// </summary>
public sealed class AuditLog
{
    /// <summary>
    /// Identifiant unique de l evenement d audit.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Identifiant de l acteur quand il est connu.
    /// </summary>
    public Guid? ActorUserId { get; set; }

    /// <summary>
    /// Nom lisible de l acteur (email ou nom complet).
    /// </summary>
    public string Actor { get; set; } = string.Empty;

    /// <summary>
    /// Action metier effectuee (ex: user.create, user.update).
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>
    /// Cible de l action sous forme lisible (optionnelle).
    /// </summary>
    public string? Entity { get; set; }

    /// <summary>
    /// Horodatage UTC de l evenement.
    /// </summary>
    public DateTime Timestamp { get; set; }

    /// <summary>
    /// Navigation optionnelle vers l utilisateur acteur.
    /// </summary>
    public User? ActorUser { get; set; }
}
