using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
[EnableRateLimiting("write-operations")]
public sealed class AdminOperationsController(AppDbContext dbContext) : ControllerBase
{
    private static readonly string[] MatrixRoles = ["SuperAdmin", "Admin", "Manager", "Supervisor", "Intern"];
    private static readonly string[] MatrixDashboards = ["Executive", "Operations", "Evaluation", "Recruitment"];

    private static readonly Dictionary<string, string> MatrixRoleLookup = MatrixRoles
        .ToDictionary(role => role, StringComparer.OrdinalIgnoreCase);

    private static readonly Dictionary<string, string> MatrixDashboardLookup = MatrixDashboards
        .ToDictionary(dashboard => dashboard, StringComparer.OrdinalIgnoreCase);

    [HttpGet("notifications/rules", Name = "ListAdminNotificationRules")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListNotificationRules(CancellationToken cancellationToken)
    {
        var rules = await dbContext.AdminNotificationRules
            .AsNoTracking()
            .OrderBy(rule => rule.Name)
            .Select(rule => new
            {
                id = rule.Id,
                name = rule.Name,
                enabled = rule.Enabled,
                trigger = rule.Trigger
            })
            .ToListAsync(cancellationToken);

        return Ok(rules);
    }

    [HttpPatch("notifications/rules/{id:guid}", Name = "UpdateAdminNotificationRule")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateNotificationRule(
        Guid id,
        [FromBody] UpdateAdminNotificationRuleRequest request,
        CancellationToken cancellationToken)
    {
        var rule = await dbContext.AdminNotificationRules
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (rule is null)
        {
            return NotFound(new { message = "Notification rule not found." });
        }

        if (rule.Enabled == request.Enabled)
        {
            return NoContent();
        }

        rule.Enabled = request.Enabled;

        dbContext.AuditLogs.Add(CreateAuditLog(
            "admin.notification-rule.update",
            $"notification-rule:{rule.Id} enabled:{rule.Enabled}"));

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("email-templates", Name = "ListAdminEmailTemplates")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListEmailTemplates(CancellationToken cancellationToken)
    {
        var templates = await dbContext.AdminEmailTemplates
            .AsNoTracking()
            .OrderBy(template => template.Name)
            .Select(template => new
            {
                id = template.Id,
                name = template.Name,
                subject = template.Subject,
                body = template.Body
            })
            .ToListAsync(cancellationToken);

        return Ok(templates);
    }

    [HttpPatch("email-templates/{id:guid}", Name = "UpdateAdminEmailTemplate")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateEmailTemplate(
        Guid id,
        [FromBody] UpdateAdminEmailTemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeRequiredText(request.Name, "name", 120, out var normalizedName, out var nameError))
        {
            return BadRequest(new { message = nameError });
        }

        if (!TryNormalizeRequiredText(request.Subject, "subject", 300, out var normalizedSubject, out var subjectError))
        {
            return BadRequest(new { message = subjectError });
        }

        if (!TryNormalizeRequiredText(request.Body, "body", 12000, out var normalizedBody, out var bodyError))
        {
            return BadRequest(new { message = bodyError });
        }

        var template = await dbContext.AdminEmailTemplates
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (template is null)
        {
            return NotFound(new { message = "Email template not found." });
        }

        var duplicateName = await dbContext.AdminEmailTemplates
            .AsNoTracking()
            .AnyAsync(
                item => item.Id != id &&
                        EF.Functions.Collate(item.Name, "SQL_Latin1_General_CP1_CI_AS") == normalizedName,
                cancellationToken);

        if (duplicateName)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "An email template with this name already exists." });
        }

        if (string.Equals(template.Name, normalizedName, StringComparison.Ordinal) &&
            string.Equals(template.Subject, normalizedSubject, StringComparison.Ordinal) &&
            string.Equals(template.Body, normalizedBody, StringComparison.Ordinal))
        {
            return NoContent();
        }

        template.Name = normalizedName;
        template.Subject = normalizedSubject;
        template.Body = normalizedBody;

        dbContext.AuditLogs.Add(CreateAuditLog(
            "admin.email-template.update",
            $"email-template:{template.Id}"));

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("archive", Name = "TriggerAdminArchive")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> TriggerArchive(CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year;

        var existingJob = await dbContext.AdminArchiveJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Year == year, cancellationToken);

        if (existingJob is not null)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = $"An archive job already exists for year {year}.",
                id = existingJob.Id,
                year = existingJob.Year,
                status = existingJob.Status
            });
        }

        var archiveJob = new AdminArchiveJob
        {
            Id = Guid.NewGuid(),
            Year = year,
            TriggeredBy = UserContextHelper.ResolveCurrentActorName(User),
            TriggeredAt = DateTime.UtcNow,
            Status = "queued"
        };

        dbContext.AdminArchiveJobs.Add(archiveJob);

        dbContext.AuditLogs.Add(CreateAuditLog(
            "admin.archive.trigger",
            $"archive-job:{archiveJob.Id} year:{archiveJob.Year}"));

        await dbContext.SaveChangesAsync(cancellationToken);

        return Accepted(new
        {
            id = archiveJob.Id,
            year = archiveJob.Year,
            triggeredBy = archiveJob.TriggeredBy,
            triggeredAt = archiveJob.TriggeredAt,
            status = archiveJob.Status
        });
    }

    [HttpGet("archive/history", Name = "ListAdminArchiveHistory")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListArchiveHistory(CancellationToken cancellationToken)
    {
        var history = await dbContext.AdminArchiveJobs
            .AsNoTracking()
            .OrderByDescending(item => item.Year)
            .ThenByDescending(item => item.TriggeredAt)
            .Select(item => new
            {
                id = item.Id,
                year = item.Year,
                triggeredBy = item.TriggeredBy,
                triggeredAt = item.TriggeredAt,
                status = item.Status
            })
            .ToListAsync(cancellationToken);

        return Ok(history);
    }

    [HttpGet("bi-access", Name = "GetAdminBiAccessMatrix")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiAccessMatrix(CancellationToken cancellationToken)
    {
        var permissions = await dbContext.AdminBiAccessPermissions
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var lookup = permissions.ToDictionary(
            permission => BuildMatrixKey(permission.Role, permission.Dashboard),
            permission => permission.Allowed,
            StringComparer.OrdinalIgnoreCase);

        var matrix = MatrixRoles
            .Select(role => new
            {
                role,
                dashboards = MatrixDashboards.ToDictionary(
                    dashboard => dashboard,
                    dashboard => lookup.TryGetValue(BuildMatrixKey(role, dashboard), out var allowed) && allowed)
            })
            .ToList();

        return Ok(matrix);
    }

    [HttpPatch("bi-access", Name = "UpdateAdminBiAccessMatrix")]
    // RBAC policy: operational endpoints must be shared by Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateBiAccessMatrix(
        [FromBody] IReadOnlyList<UpdateAdminBiAccessMatrixRowRequest>? matrix,
        CancellationToken cancellationToken)
    {
        if (matrix is null || matrix.Count == 0)
        {
            return BadRequest(new { message = "BI access matrix payload is required." });
        }

        var desiredValues = new Dictionary<string, (string Role, string Dashboard, bool Allowed)>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in matrix)
        {
            if (!MatrixRoleLookup.TryGetValue(row.Role?.Trim() ?? string.Empty, out var canonicalRole))
            {
                return BadRequest(new { message = $"Unsupported role '{row.Role}'." });
            }

            if (row.Dashboards is null)
            {
                return BadRequest(new { message = $"dashboards map is required for role '{canonicalRole}'." });
            }

            foreach (var dashboardEntry in row.Dashboards)
            {
                if (!MatrixDashboardLookup.TryGetValue(dashboardEntry.Key?.Trim() ?? string.Empty, out var canonicalDashboard))
                {
                    return BadRequest(new { message = $"Unsupported dashboard '{dashboardEntry.Key}'." });
                }

                desiredValues[BuildMatrixKey(canonicalRole, canonicalDashboard)] = (canonicalRole, canonicalDashboard, dashboardEntry.Value);
            }
        }

        foreach (var role in MatrixRoles)
        {
            foreach (var dashboard in MatrixDashboards)
            {
                var key = BuildMatrixKey(role, dashboard);
                if (!desiredValues.ContainsKey(key))
                {
                    desiredValues[key] = (role, dashboard, false);
                }
            }
        }

        var existingEntries = await dbContext.AdminBiAccessPermissions
            .ToListAsync(cancellationToken);

        foreach (var entry in existingEntries)
        {
            var key = BuildMatrixKey(entry.Role, entry.Dashboard);
            if (desiredValues.TryGetValue(key, out var desiredValue))
            {
                entry.Allowed = desiredValue.Allowed;
                desiredValues.Remove(key);
            }
            else
            {
                dbContext.AdminBiAccessPermissions.Remove(entry);
            }
        }

        foreach (var desiredValue in desiredValues.Values)
        {
            dbContext.AdminBiAccessPermissions.Add(new AdminBiAccessPermission
            {
                Role = desiredValue.Role,
                Dashboard = desiredValue.Dashboard,
                Allowed = desiredValue.Allowed
            });
        }

        dbContext.AuditLogs.Add(CreateAuditLog(
            "admin.bi-access.update",
            $"entries:{MatrixRoles.Length * MatrixDashboards.Length}"));

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private AuditLog CreateAuditLog(string action, string entity)
    {
        return new AuditLog
        {
            ActorUserId = UserContextHelper.ResolveCurrentUserId(User),
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = action,
            Entity = entity,
            Timestamp = DateTime.UtcNow
        };
    }

    private static string BuildMatrixKey(string role, string dashboard)
    {
        return $"{role}|{dashboard}";
    }

    private static bool TryNormalizeRequiredText(
        string? value,
        string fieldName,
        int maxLength,
        out string normalizedValue,
        out string error)
    {
        normalizedValue = string.Empty;
        error = string.Empty;

        if (string.IsNullOrWhiteSpace(value))
        {
            error = $"{fieldName} is required.";
            return false;
        }

        normalizedValue = value.Trim();
        if (normalizedValue.Length > maxLength)
        {
            error = $"{fieldName} cannot exceed {maxLength} characters.";
            return false;
        }

        return true;
    }
}
