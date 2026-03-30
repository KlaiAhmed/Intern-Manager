/// <summary>
/// 📁 Emplacement : api/Models/DTOs/Auth/SignupRequest.cs
/// 🎯 Rôle       : Décrit les données envoyées par le client pour la création d un compte utilisateur.
/// 📦 Contient   : [SignupRequest]
/// </summary>
using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

/// <summary>
/// Représente la charge utile (payload) d une requête d inscription vers l API.
/// </summary>
public sealed class SignupRequest
{
    [Required]
    [MaxLength(100)]
    /// <summary>
    /// Prénom du nouvel utilisateur.
    /// </summary>
    public string FirstName { get; init; } = string.Empty;

    [Required]
    [MaxLength(100)]
    /// <summary>
    /// Nom du nouvel utilisateur.
    /// </summary>
    public string LastName { get; init; } = string.Empty;

    [Required]
    [EmailAddress]
    /// <summary>
    /// Adresse email utilisée comme identifiant de connexion.
    /// </summary>
    public string Email { get; init; } = string.Empty;

    [Required]
    [MinLength(8)]
    /// <summary>
    /// Mot de passe en clair transmis au serveur pour hachage.
    /// </summary>
    public string Password { get; init; } = string.Empty;

    [Required]
    /// <summary>
    /// Rôle initial demandé par l utilisateur (ex: intern, supervisor, manager).
    /// </summary>
    public string Role { get; init; } = string.Empty;
}
