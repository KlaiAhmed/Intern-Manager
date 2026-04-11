using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

/// <summary>
/// Représente la charge utile (payload) d une requête d inscription vers l API.
/// </summary>
public sealed class SignupRequest
{
    /// <summary>
    /// Prénom du nouvel utilisateur.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string FirstName { get; init; } = string.Empty;

    /// <summary>
    /// Nom du nouvel utilisateur.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string LastName { get; init; } = string.Empty;

    /// <summary>
    /// Adresse email utilisée comme identifiant de connexion.
    /// </summary>
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    /// <summary>
    /// Mot de passe en clair transmis au serveur pour hachage.
    /// </summary>
    [Required]
    [MinLength(8)]
    public string Password { get; init; } = string.Empty;

    /// <summary>
    /// Rôle initial demandé par l utilisateur (ex: intern, supervisor, manager).
    /// </summary>
    [Required]
    public string Role { get; init; } = string.Empty;
}
