/// <summary>
/// 📁 Emplacement : api/Services/Auth/AuthService.cs
/// 🎯 Rôle       : Implémente la logique complète de session d authentification (login, refresh, logout).
/// 📦 Contient   : [AuthService, RefreshTokenEntry]
/// </summary>
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using InternManager.Api.Common.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace InternManager.Api.Services.Auth;

/// <summary>
/// Service métier qui crée les jetons, valide les sessions et applique la rotation des refresh tokens.
/// </summary>
/// <param name="userStore">Source de lecture des utilisateurs utilisée pour valider les identifiants.</param>
/// <param name="jwtOptions">Options JWT de signature, d émetteur et de durée.</param>
public sealed class AuthService(
    IAuthUserStore userStore,
    IOptions<JwtOptions> jwtOptions) : IAuthService
{
    /// <summary>
    /// Valeurs de configuration JWT résolues depuis <see cref="JwtOptions"/>.
    /// </summary>
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;

    /// <summary>
    /// Clé de signature convertie en tableau d octets pour la création des jetons.
    /// </summary>
    private readonly byte[] _signingKey = Encoding.UTF8.GetBytes(jwtOptions.Value.Key);

    /// <summary>
    /// Dictionnaire en mémoire des refresh tokens actifs, indexés par empreinte SHA-256.
    /// </summary>
    private readonly Dictionary<string, RefreshTokenEntry> _refreshTokens = new(StringComparer.Ordinal);

    /// <summary>
    /// Verrou asynchrone pour éviter les conflits d écriture lors des opérations sur les refresh tokens.
    /// </summary>
    private readonly SemaphoreSlim _refreshTokenLock = new(1, 1);

    /// <summary>
    /// Vérifie email/mot de passe puis crée une nouvelle session authentifiée.
    /// </summary>
    /// <param name="email">Adresse email fournie à la connexion.</param>
    /// <param name="password">Mot de passe en clair fourni à la connexion.</param>
    /// <param name="rememberMe">Indique si la session doit être persistante (7 jours) ou éphémère (1 jour).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Un <see cref="AuthSessionTokens"/> si les identifiants sont corrects, sinon <see langword="null"/>.
    /// </returns>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    public async Task<AuthSessionTokens?> LoginAsync(string email, string password, bool rememberMe, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        var user = await userStore.FindByEmailAsync(email, cancellationToken);
        if (user is null || !PasswordHasher.VerifyPassword(password, user.PasswordHash))
        {
            return null;
        }

        await _refreshTokenLock.WaitAsync(cancellationToken);
        try
        {
            CleanupExpiredTokensNoLock(DateTime.UtcNow);
            return IssueNewSessionNoLock(user, DateTime.UtcNow, rememberMe);
        }
        finally
        {
            _refreshTokenLock.Release();
        }
    }

    /// <summary>
    /// Valide un refresh token existant, l invalide immédiatement, puis émet une nouvelle session.
    /// </summary>
    /// <param name="refreshToken">Refresh token reçu depuis le cookie client.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Un <see cref="AuthSessionTokens"/> renouvelé si le token est valide, sinon <see langword="null"/>.
    /// </returns>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    public async Task<AuthSessionTokens?> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var oldRefreshTokenHash = HashOpaqueToken(refreshToken);

        await _refreshTokenLock.WaitAsync(cancellationToken);
        try
        {
            CleanupExpiredTokensNoLock(now);

            if (!_refreshTokens.TryGetValue(oldRefreshTokenHash, out var existingToken))
            {
                return null;
            }

            if (existingToken.ExpiresAtUtc <= now)
            {
                _refreshTokens.Remove(oldRefreshTokenHash);
                return null;
            }

            var user = await userStore.FindByUserIdAsync(existingToken.UserId, cancellationToken);
            if (user is null)
            {
                _refreshTokens.Remove(oldRefreshTokenHash);
                return null;
            }

            // Invalidation immediate pour empecher toute reutilisation de l ancien token.
            _refreshTokens.Remove(oldRefreshTokenHash);

            return IssueNewSessionNoLock(user, now, existingToken.RememberMe);
        }
        finally
        {
            _refreshTokenLock.Release();
        }
    }

    /// <summary>
    /// Déconnecte un utilisateur en supprimant ses refresh tokens connus.
    /// </summary>
    /// <param name="userId">Identifiant utilisateur pour suppression en masse des tokens.</param>
    /// <param name="refreshToken">Refresh token spécifique à supprimer si présent.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>Une tâche qui se termine quand l invalidation des tokens est finie.</returns>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    public async Task LogoutAsync(Guid? userId, string? refreshToken, CancellationToken cancellationToken = default)
    {
        await _refreshTokenLock.WaitAsync(cancellationToken);
        try
        {
            CleanupExpiredTokensNoLock(DateTime.UtcNow);

            if (userId.HasValue)
            {
                var keysForUser = _refreshTokens
                    .Where(entry => entry.Value.UserId == userId.Value)
                    .Select(entry => entry.Key)
                    .ToList();

                foreach (var key in keysForUser)
                {
                    _refreshTokens.Remove(key);
                }
            }

            if (!string.IsNullOrWhiteSpace(refreshToken))
            {
                _refreshTokens.Remove(HashOpaqueToken(refreshToken));
            }
        }
        finally
        {
            _refreshTokenLock.Release();
        }
    }

    /// <summary>
    /// Crée les nouveaux jetons d accès, de rafraîchissement et CSRF puis les enregistre côté serveur.
    /// </summary>
    /// <param name="user">Utilisateur authentifié pour lequel créer la session.</param>
    /// <param name="now">Date UTC de référence utilisée pour calculer les expirations.</param>
    /// <param name="rememberMe">Indique si la session doit être persistante (7 jours) ou éphémère (1 jour).</param>
    /// <returns>Un objet <see cref="AuthSessionTokens"/> contenant les nouvelles valeurs de session.</returns>
    private AuthSessionTokens IssueNewSessionNoLock(AuthUserRecord user, DateTime now, bool rememberMe = true)
    {
        var accessTokenExpiresAtUtc = now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        // Si rememberMe est false, la session dure 1 jour, sinon elle dure selon la configuration (7 jours par défaut).
        var refreshTokenDays = rememberMe ? _jwtOptions.RefreshTokenDays : 1;
        var refreshTokenExpiresAtUtc = now.AddDays(refreshTokenDays);
        var csrfToken = GenerateOpaqueToken(32);

        var accessToken = GenerateAccessToken(user, csrfToken, accessTokenExpiresAtUtc, now);
        var refreshToken = GenerateOpaqueToken(64);

        var refreshTokenHash = HashOpaqueToken(refreshToken);
        _refreshTokens[refreshTokenHash] = new RefreshTokenEntry(user.UserId, refreshTokenExpiresAtUtc, rememberMe);

        return new AuthSessionTokens(
            accessToken,
            accessTokenExpiresAtUtc,
            refreshToken,
            refreshTokenExpiresAtUtc,
            csrfToken);
    }

    /// <summary>
    /// Génère un jeton d accès JWT signé contenant les claims métier et techniques nécessaires.
    /// </summary>
    /// <param name="user">Utilisateur source des claims d identité et de rôle.</param>
    /// <param name="csrfToken">Token CSRF injecté dans les claims du JWT.</param>
    /// <param name="expiresAtUtc">Date UTC d expiration du jeton.</param>
    /// <param name="now">Date UTC de début de validité du jeton.</param>
    /// <returns>Chaîne JWT signée prête à être envoyée au client.</returns>
    private string GenerateAccessToken(AuthUserRecord user, string csrfToken, DateTime expiresAtUtc, DateTime now)
    {
        var claims = new List<Claim>
        {
            new("userId", user.UserId.ToString()),
            new("email", user.Email),
            new("username", user.Email),
            new("role", user.Role),
            new("csrf", csrfToken),
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.Email),
            new(ClaimTypes.Role, user.Role)
        };

        var tokenDescriptor = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: now,
            expires: expiresAtUtc,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(_signingKey),
                SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
    }

    /// <summary>
    /// Produit un jeton opaque aléatoire encodé en Base64.
    /// </summary>
    /// <param name="byteLength">Nombre d octets aléatoires à générer avant encodage.</param>
    /// <returns>Chaîne aléatoire Base64 utilisable comme token non lisible.</returns>
    private static string GenerateOpaqueToken(int byteLength)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLength);
        return Convert.ToBase64String(bytes);
    }

    /// <summary>
    /// Calcule une empreinte SHA-256 d un token opaque pour stockage côté serveur.
    /// </summary>
    /// <param name="token">Token brut à convertir en empreinte.</param>
    /// <returns>Empreinte hexadécimale en majuscules.</returns>
    private static string HashOpaqueToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash);
    }

    /// <summary>
    /// Supprime de la mémoire tous les refresh tokens expirés.
    /// </summary>
    /// <param name="utcNow">Date UTC de comparaison pour décider l expiration.</param>
    private void CleanupExpiredTokensNoLock(DateTime utcNow)
    {
        var expiredKeys = _refreshTokens
            .Where(entry => entry.Value.ExpiresAtUtc <= utcNow)
            .Select(entry => entry.Key)
            .ToList();

        foreach (var key in expiredKeys)
        {
            _refreshTokens.Remove(key);
        }
    }

    /// <summary>
    /// Représente une entrée interne de refresh token avec l identifiant utilisateur et sa date d expiration.
    /// </summary>
    /// <param name="UserId">Identifiant de l utilisateur propriétaire du token.</param>
    /// <param name="ExpiresAtUtc">Date UTC d expiration du token.</param>
    /// <param name="RememberMe">Indique si la session associée est persistante.</param>
    private sealed record RefreshTokenEntry(Guid UserId, DateTime ExpiresAtUtc, bool RememberMe);
}
