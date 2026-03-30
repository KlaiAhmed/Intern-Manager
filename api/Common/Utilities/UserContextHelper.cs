using System.Security.Claims;
using InternManager.Api.Common.Enums;

namespace InternManager.Api.Common.Utilities;

public static class UserContextHelper
{
    public static Guid? ResolveCurrentUserId(ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirstValue("userId")
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(userIdClaim, out var userId)
            ? userId
            : null;
    }

    public static string ResolveCurrentActorName(ClaimsPrincipal user)
    {
        var actorName = user.FindFirstValue("email")
            ?? user.FindFirstValue(ClaimTypes.Email)
            ?? user.Identity?.Name;

        return string.IsNullOrWhiteSpace(actorName)
            ? "unknown"
            : actorName.Trim();
    }

    public static bool IsCurrentSupervisorScope(string? supervisorScope, Guid currentSupervisorId)
    {
        if (string.IsNullOrWhiteSpace(supervisorScope) ||
            string.Equals(supervisorScope, "me", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return Guid.TryParse(supervisorScope, out var parsedSupervisorId) &&
               parsedSupervisorId == currentSupervisorId;
    }

    public static bool IsCurrentInternScope(string? internScope, Guid currentInternId)
    {
        if (string.IsNullOrWhiteSpace(internScope) ||
            string.Equals(internScope, "me", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return Guid.TryParse(internScope, out var parsedInternId) &&
               parsedInternId == currentInternId;
    }

    public static UserRole? ResolveCurrentUserRole(ClaimsPrincipal user)
    {
        var roleClaim = user.FindFirstValue("role") ?? user.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(roleClaim))
        {
            return null;
        }

        return Enum.TryParse<UserRole>(roleClaim, true, out var parsedRole)
            ? parsedRole
            : null;
    }
}
