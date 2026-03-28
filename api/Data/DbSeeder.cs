using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data;

public static class DbSeeder
{
    public static async Task SeedSuperAdminAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("DbSeeder");

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

        var user = new User
        {
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            PasswordHash = PasswordHasher.HashPassword(password),
            Role = UserRole.SuperAdmin,
            Status = UserStatus.Active
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("SuperAdmin created successfully.");
    }

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
