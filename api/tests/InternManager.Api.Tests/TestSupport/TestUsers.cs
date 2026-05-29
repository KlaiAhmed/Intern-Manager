using System.Security.Claims;
using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace InternManager.Api.Tests.TestSupport;

internal static class TestUsers
{
    public static User Create(
        Guid id,
        UserRole role,
        string? email = null,
        UserStatus status = UserStatus.Active,
        InternVerificationStatus verificationStatus = InternVerificationStatus.NOT_APPLICABLE,
        Guid? departmentId = null)
    {
        var now = DateTime.UtcNow;

        return new User
        {
            Id = id,
            FirstName = role.ToString(),
            LastName = "User",
            Email = email ?? $"{role.ToString().ToLowerInvariant()}.{id:N}@example.com",
            PasswordHash = "hash",
            Role = role,
            Status = status,
            VerificationStatus = role == UserRole.Intern && verificationStatus == InternVerificationStatus.NOT_APPLICABLE
                ? InternVerificationStatus.ACTIVE
                : verificationStatus,
            DepartmentId = departmentId,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public static ClaimsPrincipal Principal(
        Guid userId,
        UserRole role,
        string? email = null,
        string? csrf = null)
    {
        var effectiveEmail = email ?? $"{role.ToString().ToLowerInvariant()}@example.com";
        var claims = new List<Claim>
        {
            new("userId", userId.ToString()),
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("email", effectiveEmail),
            new(ClaimTypes.Email, effectiveEmail),
            new(ClaimTypes.Name, effectiveEmail),
            new("role", role.ToString()),
            new(ClaimTypes.Role, role.ToString())
        };

        if (!string.IsNullOrWhiteSpace(csrf))
        {
            claims.Add(new Claim("csrf", csrf));
        }

        return new ClaimsPrincipal(
            new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role));
    }

    public static DefaultHttpContext HttpContext(
        Guid userId,
        UserRole role,
        string? email = null,
        string? csrf = null)
    {
        return new DefaultHttpContext
        {
            User = Principal(userId, role, email, csrf)
        };
    }

    public static ControllerContext ControllerContext(
        Guid userId,
        UserRole role,
        string? email = null,
        string? csrf = null)
    {
        return new ControllerContext
        {
            HttpContext = HttpContext(userId, role, email, csrf)
        };
    }
}
