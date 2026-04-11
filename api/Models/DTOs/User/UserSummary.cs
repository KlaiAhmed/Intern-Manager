namespace InternManager.Api.Models.DTOs.User;

/// <summary>
/// Résumé du profil utilisateur retourné par l endpoint /me/summary.
/// </summary>
public sealed class UserSummary
{
    /// <summary>
    /// Identifiant unique de l utilisateur.
    /// </summary>
    public Guid Id { get; init; }

    /// <summary>
    /// Prénom de l utilisateur.
    /// </summary>
    public string FirstName { get; init; } = string.Empty;

    /// <summary>
    /// Nom de famille de l utilisateur.
    /// </summary>
    public string LastName { get; init; } = string.Empty;

    /// <summary>
    /// Adresse email de l utilisateur.
    /// </summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>
    /// Rôle fonctionnel de l utilisateur.
    /// </summary>
    public string Role { get; init; } = string.Empty;

    /// <summary>
    /// État du compte utilisateur.
    /// </summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>
    /// Nom complet formaté (Prénom Nom).
    /// </summary>
    public string FullName { get; init; } = string.Empty;
}
