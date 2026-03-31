using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace InternManager.Api.Middleware;

/// <summary>
/// Middleware de développement qui injecte un utilisateur authentifié sur les routes API non `me`.
/// </summary>
public sealed class DevelopmentLazyAuthBypassMiddleware(RequestDelegate next)
{
    public const string LazyBypassItemKey = "development.lazy-auth-bypass";

    private const string DevelopmentAuthenticationType = "DevelopmentLazyAuthBypass";
    private const string DevelopmentBypassClaimType = "developmentBypass";
    private const string DevelopmentBypassClaimValue = "true";
    private const string DefaultRole = "SuperAdmin";
    private const string DevelopmentCsrfToken = "dev-lazy-csrf-token";

    private static readonly Guid SuperAdminUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid AdminUserId = Guid.Parse("00000000-0000-0000-0000-000000000002");
    private static readonly Guid ManagerUserId = Guid.Parse("00000000-0000-0000-0000-000000000003");
    private static readonly Guid SupervisorUserId = Guid.Parse("00000000-0000-0000-0000-000000000004");
    private static readonly Guid InternUserId = Guid.Parse("00000000-0000-0000-0000-000000000005");
    private static readonly Guid GenericUserId = Guid.Parse("00000000-0000-0000-0000-000000000099");

    private static readonly string[] RolePreferenceOrder =
    [
        "SuperAdmin",
        "Admin",
        "Manager",
        "Supervisor",
        "Intern"
    ];

    public async Task InvokeAsync(HttpContext context)
    {
        if (!ShouldApplyLazyBypass(context.Request.Path))
        {
            await next(context);
            return;
        }

        context.Items[LazyBypassItemKey] = true;

        if (context.User?.Identity?.IsAuthenticated != true)
        {
            InjectDevelopmentPrincipal(context);
        }

        await next(context);
    }

    public static bool IsLazyBypassActive(HttpContext context)
    {
        return context.Items.TryGetValue(LazyBypassItemKey, out var value) &&
               value is true;
    }

    private static bool ShouldApplyLazyBypass(PathString requestPath)
    {
        if (!IsApiRequest(requestPath))
        {
            return false;
        }

        return !ContainsMeSegment(requestPath);
    }

    private static bool IsApiRequest(PathString requestPath)
    {
        var rawPath = requestPath.Value;
        if (string.IsNullOrWhiteSpace(rawPath))
        {
            return false;
        }

        return IsMatchingSegment(rawPath, "/api") ||
               IsMatchingSegment(rawPath, "/auth");
    }

    private static bool IsMatchingSegment(string path, string segment)
    {
        return path.Equals(segment, StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith($"{segment}/", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ContainsMeSegment(PathString requestPath)
    {
        var rawPath = requestPath.Value;
        if (string.IsNullOrWhiteSpace(rawPath))
        {
            return false;
        }

        var segments = rawPath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return segments.Any(segment => string.Equals(segment, "me", StringComparison.OrdinalIgnoreCase));
    }

    private static void InjectDevelopmentPrincipal(HttpContext context)
    {
        var role = ResolveRoleForEndpoint(context);
        var roleToken = role.ToLowerInvariant();
        var userId = ResolveUserIdForRole(role);
        var email = $"dev.{roleToken}@axia.local";

        var claims = new List<Claim>
        {
            new(DevelopmentBypassClaimType, DevelopmentBypassClaimValue),
            new("userId", userId.ToString()),
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("email", email),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Name, email),
            new("role", role),
            new(ClaimTypes.Role, role),
            new("csrf", DevelopmentCsrfToken)
        };

        var identity = new ClaimsIdentity(claims, DevelopmentAuthenticationType, ClaimTypes.Name, "role");
        context.User = new ClaimsPrincipal(identity);

        context.Request.Headers["X-CSRF-Token"] = DevelopmentCsrfToken;
    }

    private static string ResolveRoleForEndpoint(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        var authorizeData = endpoint?.Metadata.GetOrderedMetadata<IAuthorizeData>();

        if (authorizeData is null || authorizeData.Count == 0)
        {
            return DefaultRole;
        }

        HashSet<string>? intersectedRoles = null;
        string? fallbackRole = null;

        foreach (var entry in authorizeData)
        {
            if (string.IsNullOrWhiteSpace(entry.Roles))
            {
                continue;
            }

            var declaredRoles = entry.Roles
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .ToArray();

            if (declaredRoles.Length == 0)
            {
                continue;
            }

            fallbackRole ??= declaredRoles[0];

            var currentRoleSet = new HashSet<string>(declaredRoles, StringComparer.OrdinalIgnoreCase);
            if (intersectedRoles is null)
            {
                intersectedRoles = currentRoleSet;
                continue;
            }

            intersectedRoles.IntersectWith(currentRoleSet);
        }

        if (intersectedRoles is { Count: > 0 })
        {
            foreach (var preferredRole in RolePreferenceOrder)
            {
                if (intersectedRoles.Contains(preferredRole))
                {
                    return preferredRole;
                }
            }

            return intersectedRoles.First();
        }

        return fallbackRole ?? DefaultRole;
    }

    private static Guid ResolveUserIdForRole(string role)
    {
        return role switch
        {
            "SuperAdmin" => SuperAdminUserId,
            "Admin" => AdminUserId,
            "Manager" => ManagerUserId,
            "Supervisor" => SupervisorUserId,
            "Intern" => InternUserId,
            _ => GenericUserId
        };
    }
}