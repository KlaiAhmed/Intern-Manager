using System.ComponentModel.DataAnnotations;

namespace InternManager.Api.Models.DTOs.Auth;

/// <summary>
/// Représente la charge utile (payload) d une requête de connexion vers l API.
/// </summary>
public sealed class LoginRequest
{
    /// <summary>
    /// Adresse email saisie par l utilisateur pour s authentifier.
    /// </summary>
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    /// <summary>
    /// Mot de passe en clair transmis au serveur, qui sera vérifié via son empreinte stockée.
    /// </summary>
    [Required]
    public string Password { get; init; } = string.Empty;

    /// <summary>
    /// Indique si l utilisateur souhaite une session persistante (7 jours) ou éphémère (1 jour).
    /// </summary>
    [Required]
    public bool RememberMe { get; init; }
}
