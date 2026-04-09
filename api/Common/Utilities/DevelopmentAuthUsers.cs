using InternManager.Api.Common.Enums;

namespace InternManager.Api.Common.Utilities;

public static class DevelopmentAuthUsers
{
    public static readonly IReadOnlyList<DevelopmentAuthUserSeed> Seeds =
    [
        new(
            Guid.Parse("00000000-0000-0000-0000-000000000001"),
            UserRole.SuperAdmin,
            "dev.superadmin@axia.local",
            "Dev",
            "Super Admin",
            InternVerificationStatus.NOT_APPLICABLE),
        new(
            Guid.Parse("00000000-0000-0000-0000-000000000002"),
            UserRole.Admin,
            "dev.admin@axia.local",
            "Dev",
            "Admin",
            InternVerificationStatus.NOT_APPLICABLE),
        new(
            Guid.Parse("00000000-0000-0000-0000-000000000003"),
            UserRole.Manager,
            "dev.manager@axia.local",
            "Dev",
            "Manager",
            InternVerificationStatus.NOT_APPLICABLE),
        new(
            Guid.Parse("00000000-0000-0000-0000-000000000004"),
            UserRole.Supervisor,
            "dev.supervisor@axia.local",
            "Dev",
            "Supervisor",
            InternVerificationStatus.NOT_APPLICABLE),
        new(
            Guid.Parse("00000000-0000-0000-0000-000000000005"),
            UserRole.Intern,
            "dev.intern@axia.local",
            "Dev",
            "Intern",
            InternVerificationStatus.INCOMPLETE)
    ];

    public static DevelopmentAuthUserSeed ResolveForRole(string role)
    {
        if (Enum.TryParse<UserRole>(role, true, out var parsedRole))
        {
            return Seeds.Single(seed => seed.Role == parsedRole);
        }

        return Seeds[0];
    }
}

public sealed record DevelopmentAuthUserSeed(
    Guid Id,
    UserRole Role,
    string Email,
    string FirstName,
    string LastName,
    InternVerificationStatus VerificationStatus);