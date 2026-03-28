/// <summary>
/// 📁 Emplacement : api/Common/Enums/UserStatus.cs
/// 🎯 Rôle       : Définit les états de cycle de vie d un utilisateur dans le système.
/// 📦 Contient   : [UserStatus]
/// </summary>
namespace InternManager.Api.Common.Enums;

/// <summary>
/// Représente l état courant d un compte utilisateur.
/// </summary>
public enum UserStatus
{
    /// <summary>
    /// Compte actif qui peut se connecter et utiliser l application.
    /// </summary>
    Active,

    /// <summary>
    /// Compte archivé, conservé en historique mais non utilisable en connexion.
    /// </summary>
    Archived
}
