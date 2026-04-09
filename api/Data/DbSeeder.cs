/// <summary>
/// 📁 Emplacement : api/Data/DbSeeder.cs
/// 🎯 Rôle       : Initialise les données minimales nécessaires au démarrage, notamment le compte SuperAdmin.
/// 📦 Contient   : [DbSeeder]
/// </summary>
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data.Initialization;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data;

/// <summary>
/// Regroupe les opérations d amorçage de données exécutées au démarrage de l application.
/// </summary>
public static class DbSeeder
{
    /// <summary>
    /// Vérifie la présence d un compte SuperAdmin et le crée si nécessaire.
    /// </summary>
    /// <param name="services">Fournisseur de services racine pour créer un scope d exécution.</param>
    /// <returns>Une tâche asynchrone représentant la fin de l opération d amorçage.</returns>
    /// <exception cref="InvalidOperationException">
    /// Levée quand une variable d environnement obligatoire `SUPERADMIN_*` est absente.
    /// </exception>
    public static async Task SeedSuperAdminAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("DbSeeder");
        var hostEnvironment = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();

        await SqlMigrationScriptRunner.ApplyPendingScriptsAsync(dbContext, logger, hostEnvironment.ContentRootPath);

        await ReferenceDataSeeder.SeedDefaultStatusReferencesAsync(dbContext, logger);

        await SeedDevelopmentBypassUsersAsync(dbContext, logger, hostEnvironment);

        var superAdminExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => u.Role == UserRole.SuperAdmin);

        if (superAdminExists)
        {
            logger.LogInformation("SuperAdmin already exists.");
            return;
        }

        var email = GetRequiredValue(configuration, "SUPERADMIN_EMAIL");
        var password = GetRequiredValue(configuration, "SUPERADMIN_PASSWORD");
        var firstName = GetRequiredValue(configuration, "SUPERADMIN_FIRSTNAME");
        var lastName = GetRequiredValue(configuration, "SUPERADMIN_LASTNAME");

        if (!PasswordPolicyValidator.IsValid(password))
        {
            throw new InvalidOperationException($"SUPERADMIN_PASSWORD does not satisfy policy: {PasswordPolicyValidator.ErrorMessage}");
        }

        var user = new User
        {
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            PasswordHash = PasswordHasher.HashPassword(password),
            Role = UserRole.SuperAdmin,
            Status = UserStatus.Active,
            VerificationStatus = InternVerificationStatus.NOT_APPLICABLE
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("SuperAdmin created successfully.");
    }

    private static async Task SeedDevelopmentBypassUsersAsync(AppDbContext dbContext, ILogger logger, IHostEnvironment hostEnvironment)
    {
        if (!hostEnvironment.IsDevelopment() && !hostEnvironment.IsEnvironment("Testing"))
        {
            return;
        }

        var developmentUsers = new List<User>();

        foreach (var seed in DevelopmentAuthUsers.Seeds)
        {
            var userExists = await dbContext.Users
                .AsNoTracking()
                .AnyAsync(user => user.Id == seed.Id);

            if (userExists)
            {
                continue;
            }

            developmentUsers.Add(new User
            {
                Id = seed.Id,
                FirstName = seed.FirstName,
                LastName = seed.LastName,
                Email = seed.Email,
                PasswordHash = PasswordHasher.HashPassword("DevPassword123!"),
                Role = seed.Role,
                Status = UserStatus.Active,
                VerificationStatus = seed.VerificationStatus
            });
        }

        if (developmentUsers.Count == 0)
        {
            return;
        }

        dbContext.Users.AddRange(developmentUsers);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Seeded {Count} development bypass user(s).", developmentUsers.Count);
    }

    /// <summary>
    /// Lit une valeur de configuration obligatoire et échoue clairement si elle manque.
    /// </summary>
    /// <param name="configuration">Source de configuration applicative.</param>
    /// <param name="key">Nom de la clé à lire dans la configuration.</param>
    /// <returns>La valeur non vide associée à la clé demandée.</returns>
    /// <exception cref="InvalidOperationException">Levée si la clé est absente ou vide.</exception>
    private static string GetRequiredValue(IConfiguration configuration, string key)
    {
        var value = configuration[key];
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Required environment variable '{key}' is missing for SuperAdmin seeding.");
        }

        return value;
    }

}
