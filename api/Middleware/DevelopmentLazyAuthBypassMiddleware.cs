using System.Security.Claims;
using InternManager.Api.Common.Utilities;
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
        EnsureDevelopmentEnvironment();

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
        var developmentUser = DevelopmentAuthUsers.ResolveForRole(role);

        var claims = new List<Claim>
        {
            new(DevelopmentBypassClaimType, DevelopmentBypassClaimValue),
            new("userId", developmentUser.Id.ToString()),
            new(ClaimTypes.NameIdentifier, developmentUser.Id.ToString()),
            new("email", developmentUser.Email),
            new(ClaimTypes.Email, developmentUser.Email),
            new(ClaimTypes.Name, developmentUser.Email),
            new("role", developmentUser.Role.ToString()),
            new(ClaimTypes.Role, developmentUser.Role.ToString()),
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

    private static void EnsureDevelopmentEnvironment()
    {
        var environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? string.Empty;

        if (!string.Equals(environmentName, "Development", StringComparison.Ordinal) &&
            !string.Equals(environmentName, "Testing", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("DevelopmentLazyAuthBypassMiddleware must never run in non-development environments.");
        }
    }
}