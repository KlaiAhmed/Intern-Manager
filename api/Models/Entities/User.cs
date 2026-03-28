/// <summary>
/// 📁 Emplacement : api/Models/Entities/User.cs
/// 🎯 Rôle       : Définit l entité utilisateur persistée en base de données.
/// 📦 Contient   : [User]
/// </summary>
using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Entities;

/// <summary>
/// Représente un utilisateur métier enregistré dans l application, avec son identité, son rôle et son état.
/// </summary>
public class User
{
    /// <summary>
    /// Identifiant unique technique de l utilisateur.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Prénom de l utilisateur affiché dans l interface.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Nom de famille de l utilisateur.
    /// </summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Adresse email unique, utilisée notamment pour la connexion.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Empreinte chiffrée du mot de passe. Le mot de passe brut n est jamais stocké.
    /// </summary>
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// Rôle fonctionnel de l utilisateur, défini par <see cref="UserRole"/>.
    /// </summary>
    public UserRole Role { get; set; }

    /// <summary>
    /// État du compte utilisateur, défini par <see cref="UserStatus"/>.
    /// </summary>
    public UserStatus Status { get; set; }

    /// <summary>
    /// Date de création du compte en temps universel (UTC).
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Date de dernière mise à jour du compte en temps universel (UTC).
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
