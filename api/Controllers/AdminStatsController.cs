using InternManager.Api.Common.Enums;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/stats")]
[Authorize]
public sealed class AdminStatsController(AppDbContext dbContext) : ControllerBase
{
    private const string SuperAdminRole = "SuperAdmin";
    private const string AdminRole = "Admin";

    [HttpGet("interns/active", Name = "GetActiveInterns")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetActiveInternsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Intern, cancellationToken);
        return Ok(new { count });
    }

    [HttpGet("interns/count", Name = "GetInternsCount")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Intern, cancellationToken);
        return Ok(new { count });
    }

    [HttpGet("supervisors", Name = "GetSupervisorsStats")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Supervisor, cancellationToken);
        return Ok(new { count });
    }

    [HttpGet("supervisors/count", Name = "GetSupervisorsCount")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorsCountForAdmin(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Supervisor, cancellationToken);
        return Ok(new { count });
    }

    [HttpGet("missions", Name = "GetMissionsStats")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMissionsCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Missions
            .AsNoTracking()
            .CountAsync(cancellationToken);

        return Ok(new { count });
    }

    [HttpGet("admins", Name = "GetAdminsStats")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAdminsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Admin, cancellationToken);
        return Ok(new { count });
    }

    [HttpGet("internships/active", Name = "GetActiveInternships")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetActiveInternshipsCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Users
            .AsNoTracking()
            .CountAsync(user => user.Role == UserRole.Intern && user.Status == UserStatus.Active, cancellationToken);

        return Ok(new { count });
    }

    [HttpGet("interns-by-department", Name = "GetInternsByDepartment")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsByDepartment(CancellationToken cancellationToken)
    {
        var data = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Intern && user.Status == UserStatus.Active)
            .Select(user => new
            {
                DepartmentName = user.Department != null
                    ? user.Department.Name
                    : null
            })
            .GroupBy(entry => string.IsNullOrWhiteSpace(entry.DepartmentName) ? "Unassigned" : entry.DepartmentName!)
            .Select(group => new
            {
                name = group.Key,
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToListAsync(cancellationToken);

        return Ok(new { data });
    }

    [HttpGet("internships-by-status", Name = "GetInternshipsByStatus")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternshipsByStatus(CancellationToken cancellationToken)
    {
        var data = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Intern)
            .GroupBy(user => user.Status)
            .Select(group => new
            {
                name = group.Key.ToString().ToLowerInvariant(),
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToListAsync(cancellationToken);

        return Ok(new { data });
    }

    [HttpGet("internships-by-type", Name = "GetInternshipsByType")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternshipsByType(CancellationToken cancellationToken)
    {
        var loggedTypeValues = await dbContext.AuditLogs
            .AsNoTracking()
            .Where(log => EF.Functions.Like(log.Action, "internship.create%") &&
                          log.Entity != null &&
                          log.Entity != string.Empty)
            .Select(log => log.Entity!)
            .ToListAsync(cancellationToken);

        var typeFromLogs = loggedTypeValues
            .Select(TryExtractInternshipType)
            .Where(typeName => !string.IsNullOrWhiteSpace(typeName))
            .Select(typeName => typeName!)
            .GroupBy(typeName => typeName, StringComparer.OrdinalIgnoreCase)
            .Select(group => new
            {
                name = group.Key,
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToList();

        if (typeFromLogs.Count > 0)
        {
            return Ok(new { data = typeFromLogs });
        }

        var configuredTypes = await dbContext.InternshipTypes
            .AsNoTracking()
            .OrderBy(type => type.Name)
            .Select(type => new
            {
                name = type.Name,
                value = 0
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data = configuredTypes });
    }

    [HttpGet("deliverables/pending", Name = "GetPendingDeliverablesStats")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPendingDeliverablesCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Deliverables
            .AsNoTracking()
            .CountAsync(deliverable => deliverable.Status == "pending" || deliverable.Status == "submitted", cancellationToken);

        return Ok(new { count });
    }

    private Task<int> CountActiveUsersByRoleAsync(UserRole role, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .CountAsync(user => user.Role == role && user.Status == UserStatus.Active, cancellationToken);
    }

    private static string? TryExtractInternshipType(string entity)
    {
        if (string.IsNullOrWhiteSpace(entity))
        {
            return null;
        }

        const string marker = "type:";
        var markerIndex = entity.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0)
        {
            return null;
        }

        var valueStart = markerIndex + marker.Length;
        if (valueStart >= entity.Length)
        {
            return null;
        }

        var valueChunk = entity[valueStart..].Trim();
        if (valueChunk.Length == 0)
        {
            return null;
        }

        var separatorIndex = valueChunk.IndexOf(' ');
        var extractedValue = separatorIndex < 0
            ? valueChunk
            : valueChunk[..separatorIndex];

        return string.IsNullOrWhiteSpace(extractedValue)
            ? null
            : extractedValue.Trim();
    }
}
