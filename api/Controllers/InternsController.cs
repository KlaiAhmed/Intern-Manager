using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/interns")]
[Authorize]
public sealed class InternsController(
    AppDbContext dbContext) : ControllerBase
{
    [HttpGet(Name = "ListInterns")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListInterns(
        [FromQuery] string? status = null,
        [FromQuery] string? verificationStatus = null,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var currentRole = UserContextHelper.ResolveCurrentUserRole(User);

        UserStatus? parsedAccountStatus = null;
        InternVerificationStatus? parsedVerificationStatus = null;

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (TryParseUserStatus(status, out var parsedStatus))
            {
                parsedAccountStatus = parsedStatus;
            }
            else if (string.IsNullOrWhiteSpace(verificationStatus) && TryParseVerificationStatus(status, out var parsedLegacyVerificationStatus))
            {
                parsedVerificationStatus = parsedLegacyVerificationStatus;
            }
            else
            {
                return BadRequest(new { message = "Invalid account status filter." });
            }
        }

        if (!string.IsNullOrWhiteSpace(verificationStatus))
        {
            if (!TryParseVerificationStatus(verificationStatus, out var parsed))
            {
                return BadRequest(new { message = "Invalid intern verification status filter." });
            }

            parsedVerificationStatus = parsed;
        }

        var safeLimit = Math.Clamp(limit, 1, 500);

        var query = dbContext.InternProfiles
            .AsNoTracking()
            .Include(profile => profile.Intern)
            .Where(profile => profile.Intern != null && profile.Intern.Role == UserRole.Intern)
            .AsQueryable();

        if (currentRole == UserRole.Supervisor)
        {
            var assignedInternIds = await ResolveAssignedInternIdsAsync(currentUserId.Value, cancellationToken);
            if (assignedInternIds.Count == 0)
            {
                return Ok(new { data = Array.Empty<object>(), total = 0 });
            }

            query = query.Where(profile => assignedInternIds.Contains(profile.InternId));
        }

        if (parsedAccountStatus.HasValue)
        {
            query = query.Where(profile => profile.Intern != null && profile.Intern.Status == parsedAccountStatus.Value);
        }

        if (parsedVerificationStatus.HasValue)
        {
            query = query.Where(profile => profile.Intern != null && profile.Intern.VerificationStatus == parsedVerificationStatus.Value);
        }

        var data = await query
            .OrderBy(profile => profile.Intern!.FirstName)
            .ThenBy(profile => profile.Intern!.LastName)
            .Take(safeLimit)
            .Select(profile => new
            {
                id = profile.InternId,
                fullName = $"{profile.Intern!.FirstName} {profile.Intern.LastName}".Trim(),
                email = profile.Intern!.Email,
                status = profile.Intern!.Status.ToString(),
                verificationStatus = profile.Intern!.VerificationStatus.ToString(),
                cvFileUrl = profile.CvFileUrl,
                startDate = profile.StartDate,
                endDate = profile.EndDate
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total = data.Count });
    }

    [HttpGet("{id:guid}", Name = "GetInternById")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInternById(Guid id, CancellationToken cancellationToken)
    {
        var accessDeniedResult = await GetInternAccessDeniedResultAsync(id, cancellationToken);
        if (accessDeniedResult is not null)
        {
            return accessDeniedResult;
        }

        var intern = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Id == id && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var profile = await dbContext.InternProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.InternId == id, cancellationToken);

        return Ok(new
        {
            id = intern.Id,
            firstName = intern.FirstName,
            lastName = intern.LastName,
            fullName = $"{intern.FirstName} {intern.LastName}".Trim(),
            email = intern.Email,
            status = intern.VerificationStatus.ToString(),
            accountStatus = intern.Status.ToString(),
            verificationStatus = intern.VerificationStatus.ToString(),
            cvFileUrl = profile?.CvFileUrl,
            startDate = profile?.StartDate,
            endDate = profile?.EndDate
        });
    }

    [HttpPost("{id:guid}/upload-cv", Name = "UploadInternCv")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [EnableRateLimiting("upload")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UploadCv(Guid id, [FromForm] UploadInternCvForm request, CancellationToken cancellationToken)
    {
        return StatusCode(StatusCodes.Status410Gone, new
        {
            message = "This endpoint has been retired. Use POST /api/intern/me/profile/cv."
        });
    }

    private async Task<IActionResult?> GetInternAccessDeniedResultAsync(Guid internId, CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var currentRole = UserContextHelper.ResolveCurrentUserRole(User);
        var canReadAnyIntern = currentRole is UserRole.SuperAdmin or UserRole.Admin or UserRole.Manager;
        var isSelfIntern = currentRole == UserRole.Intern && currentUserId.Value == internId;

        if (canReadAnyIntern || isSelfIntern)
        {
            return null;
        }

        if (currentRole == UserRole.Supervisor)
        {
            var assignedInternIds = await ResolveAssignedInternIdsAsync(currentUserId.Value, cancellationToken);
            if (assignedInternIds.Contains(internId))
            {
                return null;
            }

            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "You do not have access to this intern's record."
            });
        }

        return Forbid();
    }

    private async Task<HashSet<Guid>> ResolveAssignedInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var assignedInternIds = new HashSet<Guid>();

        assignedInternIds.UnionWith(await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == supervisorId && mission.InternId.HasValue)
            .Select(mission => mission.InternId!.Value)
            .ToListAsync(cancellationToken));

        assignedInternIds.UnionWith(await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId && deliverable.InternId.HasValue)
            .Select(deliverable => deliverable.InternId!.Value)
            .ToListAsync(cancellationToken));

        assignedInternIds.UnionWith(await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == supervisorId)
            .Select(evaluation => evaluation.InternId)
            .ToListAsync(cancellationToken));

        assignedInternIds.UnionWith(await dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.SupervisorId == supervisorId)
            .Select(meeting => meeting.InternId)
            .ToListAsync(cancellationToken));

        return assignedInternIds;
    }

    private static bool TryParseVerificationStatus(string? rawValue, out InternVerificationStatus status)
    {
        status = default;

        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return false;
        }

        var normalized = rawValue
            .Trim()
            .ToUpperInvariant()
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal);

        status = normalized switch
        {
            "INCOMPLETE" => InternVerificationStatus.INCOMPLETE,
            "PENDING" => InternVerificationStatus.PENDING,
            "ACTIVE" => InternVerificationStatus.ACTIVE,
            "NOTAPPLICABLE" => InternVerificationStatus.NOT_APPLICABLE,
            _ => default
        };

        return normalized is "INCOMPLETE" or "PENDING" or "ACTIVE" or "NOTAPPLICABLE";
    }

    private static bool TryParseUserStatus(string? rawValue, out UserStatus status)
    {
        status = default;

        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return false;
        }

        var normalized = rawValue
            .Trim()
            .ToUpperInvariant()
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal);

        status = normalized switch
        {
            "ACTIVE" => UserStatus.Active,
            "ARCHIVED" => UserStatus.Archived,
            _ => default
        };

        return normalized is "ACTIVE" or "ARCHIVED";
    }
}
