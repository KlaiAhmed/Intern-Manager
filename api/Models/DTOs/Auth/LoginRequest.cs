/// <summary>
/// 📁 Emplacement : api/Models/DTOs/Auth/LoginRequest.cs
/// 🎯 Rôle       : Décrit les données envoyées par le client pour une tentative de connexion.
/// 📦 Contient   : [LoginRequest]
/// </summary>
using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

/// <summary>
/// Représente la charge utile (payload) d une requête de connexion vers l API.
/// </summary>
public sealed class LoginRequest
{
    [Required]
    [EmailAddress]
    /// <summary>
    /// Adresse email saisie par l utilisateur pour s authentifier.
    /// </summary>
    public string Email { get; init; } = string.Empty;

    [Required]
    /// <summary>
    /// Mot de passe en clair transmis au serveur, qui sera vérifié via son empreinte stockée.
    /// </summary>
    public string Password { get; init; } = string.Empty;

    [Required]
    /// <summary>
    /// Indique si l utilisateur souhaite une session persistante (7 jours) ou éphémère (1 jour).
    /// </summary>
    public bool RememberMe { get; init; }
}
