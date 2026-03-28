/// <summary>
/// 📁 Emplacement : api/Common/Options/JwtOptions.cs
/// 🎯 Rôle       : Centralise les paramètres JWT lus depuis la configuration de l application.
/// 📦 Contient   : [JwtOptions]
/// </summary>
namespace InternManager.Api.Common.Options;

/// <summary>
/// Porte les valeurs de configuration nécessaires pour créer et valider les jetons JWT.
/// </summary>
public sealed class JwtOptions
{
    /// <summary>
    /// Nom de section de configuration utilisé pour lire les options JWT.
    /// </summary>
    public const string SectionName = "Jwt";

    /// <summary>
    /// Clé secrète utilisée pour signer les jetons. Elle doit être longue et privée.
    /// </summary>
    public string Key { get; init; } = string.Empty;

    /// <summary>
    /// Nom de l émetteur inscrit dans le jeton pour identifier le serveur.
    /// </summary>
    public string Issuer { get; init; } = string.Empty;

    /// <summary>
    /// Nom du destinataire attendu dans le jeton, généralement le client de l application.
    /// </summary>
    public string Audience { get; init; } = string.Empty;

    /// <summary>
    /// Durée de vie du jeton d accès en minutes.
    /// </summary>
    public int AccessTokenMinutes { get; init; } = 15;

    /// <summary>
    /// Durée de vie du jeton de rafraîchissement en jours.
    /// </summary>
    public int RefreshTokenDays { get; init; } = 7;
}
