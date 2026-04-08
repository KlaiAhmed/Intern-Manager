using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data.Initialization;

public static class ReferenceDataSeeder
{
    public static async Task SeedDefaultStatusReferencesAsync(AppDbContext dbContext, ILogger logger)
    {
        var accountStatusNames = Enum.GetNames<UserStatus>();
        var verificationStatusNames = Enum.GetNames<InternVerificationStatus>();

        var existingAccountStatusNames = await dbContext.UserAccountStatusReferences
            .AsNoTracking()
            .Select(status => status.Name)
            .ToListAsync();

        var existingVerificationStatusNames = await dbContext.UserVerificationStatusReferences
            .AsNoTracking()
            .Select(status => status.Name)
            .ToListAsync();

        var missingAccountStatuses = accountStatusNames
            .Where(defaultName => !existingAccountStatusNames.Contains(defaultName, StringComparer.OrdinalIgnoreCase))
            .Select(defaultName => new UserAccountStatusReference { Name = defaultName })
            .ToList();

        var missingVerificationStatuses = verificationStatusNames
            .Where(defaultName => !existingVerificationStatusNames.Contains(defaultName, StringComparer.OrdinalIgnoreCase))
            .Select(defaultName => new UserVerificationStatusReference { Name = defaultName })
            .ToList();

        if (missingAccountStatuses.Count == 0 && missingVerificationStatuses.Count == 0)
        {
            return;
        }

        if (missingAccountStatuses.Count > 0)
        {
            await dbContext.UserAccountStatusReferences.AddRangeAsync(missingAccountStatuses);
        }

        if (missingVerificationStatuses.Count > 0)
        {
            await dbContext.UserVerificationStatusReferences.AddRangeAsync(missingVerificationStatuses);
        }

        await dbContext.SaveChangesAsync();

        logger.LogInformation(
            "Seeded {AccountCount} account status and {VerificationCount} verification status reference value(s).",
            missingAccountStatuses.Count,
            missingVerificationStatuses.Count);
    }
}
