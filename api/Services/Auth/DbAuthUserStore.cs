using InternManager.Api.Data;
using InternManager.Api.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services.Auth;

/// <summary>
/// Implémentation de <see cref="IAuthUserStore"/> basée sur <see cref="AppDbContext"/>.
/// </summary>
/// <param name="scopeFactory">Fabrique de scope pour créer un contexte de base de données par opération.</param>
public sealed class DbAuthUserStore(IServiceScopeFactory scopeFactory) : IAuthUserStore
{
    /// <summary>
    /// Recherche un utilisateur actif par adresse email.
    /// </summary>
    /// <param name="email">Adresse email à rechercher.</param>
    /// <param name="cancellationToken">Jeton pour annuler la requête base de données.</param>
    /// <returns>
    /// Un <see cref="AuthUserRecord"/> si un utilisateur actif est trouvé, sinon <see langword="null"/>.
    /// </returns>
    public async Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();

        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                u => u.Status == UserStatus.Active &&
                     EF.Functions.Collate(u.Email, "SQL_Latin1_General_CP1_CI_AS") == normalizedEmail,
                cancellationToken);

        return user is null
            ? null
            : new AuthUserRecord(
                user.Id,
                user.Email,
                user.PasswordHash,
                user.Role.ToString());
    }

    /// <summary>
    /// Recherche un utilisateur actif par identifiant unique.
    /// </summary>
    /// <param name="userId">Identifiant de l utilisateur à rechercher.</param>
    /// <param name="cancellationToken">Jeton pour annuler la requête base de données.</param>
    /// <returns>
    /// Un <see cref="AuthUserRecord"/> si un utilisateur actif est trouvé, sinon <see langword="null"/>.
    /// </returns>
    public async Task<AuthUserRecord?> FindByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.Status == UserStatus.Active, cancellationToken);

        return user is null
            ? null
            : new AuthUserRecord(
                user.Id,
                user.Email,
                user.PasswordHash,
                user.Role.ToString());
    }
}
