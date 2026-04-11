using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using InternManager.Api.Common.Options;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace InternManager.Api.Services.Auth;

/// <summary>
/// Service métier qui crée les jetons, valide les sessions et applique la rotation des refresh tokens.
/// </summary>
/// <param name="userStore">Source de lecture des utilisateurs utilisée pour valider les identifiants.</param>
/// <param name="dbContext">Contexte EF Core pour la persistance des refresh tokens.</param>
/// <param name="jwtOptions">Options JWT de signature, d émetteur et de durée.</param>
public sealed class AuthService(
    IAuthUserStore userStore,
    AppDbContext dbContext,
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

        var now = DateTime.UtcNow;
        await CleanupExpiredTokensAsync(now, cancellationToken);
        return await IssueNewSessionAsync(user, now, rememberMe, cancellationToken);
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

        var existingToken = await dbContext.RefreshTokens
            .FirstOrDefaultAsync(token => token.Token == refreshToken, cancellationToken);

        if (existingToken is null)
        {
            return null;
        }

        if (existingToken.RevokedAt.HasValue || existingToken.ExpiresAt <= now)
        {
            return null;
        }

        var user = await userStore.FindByUserIdAsync(existingToken.UserId, cancellationToken);
        if (user is null)
        {
            existingToken.RevokedAt = now;
            await dbContext.SaveChangesAsync(cancellationToken);
            return null;
        }

        existingToken.RevokedAt = now;

        var rememberMe = (existingToken.ExpiresAt - existingToken.CreatedAt) > TimeSpan.FromDays(1.5);
        return await IssueNewSessionAsync(user, now, rememberMe, cancellationToken);
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
        var now = DateTime.UtcNow;
        var hasChanges = false;

        if (userId.HasValue)
        {
            var userTokens = await dbContext.RefreshTokens
                .Where(token => token.UserId == userId.Value && token.RevokedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var token in userTokens)
            {
                token.RevokedAt = now;
            }

            hasChanges |= userTokens.Count > 0;
        }

        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            var token = await dbContext.RefreshTokens
                .FirstOrDefaultAsync(current => current.Token == refreshToken, cancellationToken);

            if (token is not null && token.RevokedAt == null)
            {
                token.RevokedAt = now;
                hasChanges = true;
            }
        }

        if (hasChanges)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>
    /// Crée les nouveaux jetons d accès, de rafraîchissement et CSRF puis les enregistre côté serveur.
    /// </summary>
    /// <param name="user">Utilisateur authentifié pour lequel créer la session.</param>
    /// <param name="now">Date UTC de référence utilisée pour calculer les expirations.</param>
    /// <param name="rememberMe">Indique si la session doit être persistante (7 jours) ou éphémère (1 jour).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>Un objet <see cref="AuthSessionTokens"/> contenant les nouvelles valeurs de session.</returns>
    private async Task<AuthSessionTokens> IssueNewSessionAsync(
        AuthUserRecord user,
        DateTime now,
        bool rememberMe,
        CancellationToken cancellationToken)
    {
        var accessTokenExpiresAtUtc = now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        // Si rememberMe est false, la session dure 1 jour, sinon elle dure selon la configuration (7 jours par défaut).
        var refreshTokenDays = rememberMe ? _jwtOptions.RefreshTokenDays : 1;
        var refreshTokenExpiresAtUtc = now.AddDays(refreshTokenDays);
        var csrfToken = GenerateOpaqueToken(32);

        var accessToken = GenerateAccessToken(user, csrfToken, accessTokenExpiresAtUtc, now);
        var refreshToken = GenerateOpaqueToken(64);

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Token = refreshToken,
            UserId = user.UserId,
            ExpiresAt = refreshTokenExpiresAtUtc,
            RevokedAt = null,
            CreatedAt = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);

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

    private async Task CleanupExpiredTokensAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var expiredTokens = await dbContext.RefreshTokens
            .Where(token => token.ExpiresAt <= utcNow && token.RevokedAt == null)
            .ToListAsync(cancellationToken);

        if (expiredTokens.Count == 0)
        {
            return;
        }

        foreach (var token in expiredTokens)
        {
            token.RevokedAt = utcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
