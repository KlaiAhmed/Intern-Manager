namespace InternManager.Api.Services.Auth;

/// <summary>
/// Définit les opérations de session d authentification utilisées par les contrôleurs HTTP.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Vérifie les identifiants fournis et crée une nouvelle session si les données sont valides.
    /// </summary>
    /// <param name="email">Adresse email saisie par l utilisateur.</param>
    /// <param name="password">Mot de passe en clair saisi par l utilisateur.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Un <see cref="AuthSessionTokens"/> contenant les jetons de session, ou <see langword="null"/> si l authentification échoue.
    /// </returns>
    Task<AuthSessionTokens?> LoginAsync(string email, string password, bool rememberMe, CancellationToken cancellationToken = default);

    /// <summary>
    /// Valide un jeton de rafraîchissement puis émet une nouvelle session.
    /// </summary>
    /// <param name="refreshToken">Jeton de rafraîchissement reçu depuis le client.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Un <see cref="AuthSessionTokens"/> mis à jour si le jeton est valide, sinon <see langword="null"/>.
    /// </returns>
    Task<AuthSessionTokens?> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Termine une session en invalidant les jetons connus pour l utilisateur courant.
    /// </summary>
    /// <param name="userId">Identifiant utilisateur si disponible dans le contexte courant.</param>
    /// <param name="refreshToken">Jeton de rafraîchissement à invalider si disponible.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>Une tâche asynchrone représentant la fin de l opération de déconnexion.</returns>
    Task LogoutAsync(Guid? userId, string? refreshToken, CancellationToken cancellationToken = default);
}

/// <summary>
/// Représente les jetons et dates d expiration d une session d authentification complète.
/// </summary>
/// <param name="AccessToken">Jeton d accès JWT à courte durée de vie.</param>
/// <param name="AccessTokenExpiresAtUtc">Date UTC d expiration du jeton d accès.</param>
/// <param name="RefreshToken">Jeton de rafraîchissement opaque (non lisible côté client).</param>
/// <param name="RefreshTokenExpiresAtUtc">Date UTC d expiration du jeton de rafraîchissement.</param>
/// <param name="CsrfToken">Jeton CSRF utilisé pour protéger les requêtes sensibles.</param>
public sealed record AuthSessionTokens(
    string AccessToken,
    DateTime AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTime RefreshTokenExpiresAtUtc,
    string CsrfToken);
