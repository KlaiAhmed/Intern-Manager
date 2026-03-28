/// <summary>
/// 📁 Emplacement : api/Common/Enums/UserRole.cs
/// 🎯 Rôle       : Définit la liste des rôles possibles pour un utilisateur de l application.
/// 📦 Contient   : [UserRole]
/// </summary>
namespace InternManager.Api.Common.Enums;

/// <summary>
/// Représente les rôles disponibles pour contrôler les droits d accès dans l application.
/// </summary>
public enum UserRole
{
    /// <summary>
    /// Super administrateur avec tous les droits, y compris la configuration globale.
    /// </summary>
    SuperAdmin,

    /// <summary>
    /// Administrateur avec des droits étendus de gestion fonctionnelle.
    /// </summary>
    Admin,

    /// <summary>
    /// Manager qui consulte la vision globale et les indicateurs du programme.
    /// </summary>
    Manager,

    /// <summary>
    /// Superviseur qui suit les missions et l évaluation des stagiaires.
    /// </summary>
    Supervisor,

    /// <summary>
    /// Stagiaire qui accède à son propre espace de progression.
    /// </summary>
    Intern
}
