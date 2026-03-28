/// <summary>
/// 📁 Emplacement : api/Services/Auth/StubAuthUserStore.cs
/// 🎯 Rôle       : Fournit un magasin utilisateur de test en mémoire pour les scénarios de développement.
/// 📦 Contient   : [StubAuthUserStore]
/// </summary>
using InternManager.Api.Common.Enums;

namespace InternManager.Api.Services.Auth;

/// <summary>
/// Implémentation simple de <see cref="IAuthUserStore"/> qui expose un seul utilisateur factice.
/// </summary>
/// <param name="configuration">Configuration utilisée pour construire les valeurs de l utilisateur factice.</param>
public sealed class StubAuthUserStore(IConfiguration configuration) : IAuthUserStore
{
    /// <summary>
    /// Utilisateur unique conservé en mémoire pour les recherches d authentification.
    /// </summary>
    private readonly AuthUserRecord _stubUser = BuildStubUser(configuration);

    /// <summary>
    /// Recherche l utilisateur factice par email.
    /// </summary>
    /// <param name="email">Adresse email à comparer.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Le <see cref="AuthUserRecord"/> factice si l email correspond, sinon <see langword="null"/>.
    /// </returns>
    public Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return Task.FromResult<AuthUserRecord?>(null);
        }

        var match = string.Equals(_stubUser.Email, email, StringComparison.OrdinalIgnoreCase)
            ? _stubUser
            : null;

        return Task.FromResult(match);
    }

    /// <summary>
    /// Recherche l utilisateur factice par identifiant.
    /// </summary>
    /// <param name="userId">Identifiant utilisateur à comparer.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Le <see cref="AuthUserRecord"/> factice si l identifiant correspond, sinon <see langword="null"/>.
    /// </returns>
    public Task<AuthUserRecord?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var match = _stubUser.UserId == userId
            ? _stubUser
            : null;

        return Task.FromResult(match);
    }

    /// <summary>
    /// Construit l utilisateur factice à partir de la configuration ou de valeurs par défaut.
    /// </summary>
    /// <param name="configuration">Source de configuration applicative.</param>
    /// <returns>Un <see cref="AuthUserRecord"/> prêt à être utilisé par ce magasin en mémoire.</returns>
    private static AuthUserRecord BuildStubUser(IConfiguration configuration)
    {
        var email = configuration["Auth:StubUser:Email"] ?? "admin@axia.com";
        var password = configuration["Auth:StubUser:Password"] ?? "Admin@1234";
        var roleFromConfig = configuration["Auth:StubUser:Role"] ?? UserRole.Admin.ToString();
        var userIdValue = configuration["Auth:StubUser:UserId"];

        var parsedRole = Enum.TryParse<UserRole>(roleFromConfig, true, out var role)
            ? role
            : UserRole.Admin;

        var userId = Guid.TryParse(userIdValue, out var parsedUserId)
            ? parsedUserId
            : Guid.Parse("11111111-1111-1111-1111-111111111111");

        return new AuthUserRecord(
            userId,
            email,
            PasswordHasher.HashPassword(password),
            parsedRole.ToString());
    }
}
