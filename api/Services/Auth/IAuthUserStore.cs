namespace InternManager.Api.Services.Auth;

/// <summary>
/// Définit les opérations minimales pour retrouver un utilisateur utilisé par le flux d authentification.
/// Toute implémentation de cette interface doit fournir ces recherches.
/// </summary>
public interface IAuthUserStore
{
    /// <summary>
    /// Recherche un utilisateur à partir de son email.
    /// </summary>
    /// <param name="email">Adresse email à rechercher.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Un <see cref="AuthUserRecord"/> si un utilisateur correspondant est trouvé, sinon <see langword="null"/>.
    /// </returns>
    Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Recherche un utilisateur à partir de son identifiant unique.
    /// </summary>
    /// <param name="userId">Identifiant unique de l utilisateur.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Un <see cref="AuthUserRecord"/> si un utilisateur correspondant est trouvé, sinon <see langword="null"/>.
    /// </returns>
    Task<AuthUserRecord?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Représente les informations minimales d un utilisateur nécessaires pour vérifier une connexion.
/// </summary>
/// <param name="UserId">Identifiant unique de l utilisateur.</param>
/// <param name="Email">Adresse email de connexion.</param>
/// <param name="PasswordHash">Empreinte du mot de passe stockée en base.</param>
/// <param name="Role">Rôle métier de l utilisateur.</param>
public sealed record AuthUserRecord(
    Guid UserId,
    string Email,
    string PasswordHash,
    string Role);
