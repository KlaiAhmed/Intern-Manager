using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/interns")]
[Authorize]
public sealed class InternsController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    IInternSkillsService internSkillsService) : ControllerBase
{
    [HttpGet(Name = "ListInterns")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [EnableRateLimiting("read-frequent")]
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
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(InternDetailResponse), StatusCodes.Status200OK)]
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

        // Fixed-shape read with a bounded query count to avoid per-item N+1 fetch patterns.
        var intern = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == id && user.Role == UserRole.Intern)
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.Status,
                user.VerificationStatus
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var profile = await dbContext.InternProfiles
            .AsNoTracking()
            .Where(item => item.InternId == id)
            .Select(item => new
            {
                item.Id,
                item.UniversityId,
                item.Major,
                item.CurrentYearOfStudy,
                item.CvFileUrl,
                item.StartDate,
                item.EndDate
            })
            .FirstOrDefaultAsync(cancellationToken);

        string? schoolName = null;
        if (profile?.UniversityId is Guid universityId)
        {
            schoolName = await dbContext.Schools
                .AsNoTracking()
                .Where(item => item.Id == universityId)
                .Select(item => item.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        IReadOnlyList<InternDetailSkillResponse> skills = Array.Empty<InternDetailSkillResponse>();
        if (profile is not null)
        {
            skills = await dbContext.InternProfileSkills
                .AsNoTracking()
                .Where(item => item.InternProfileId == profile.Id)
                .OrderBy(item => item.Skill == null ? string.Empty : item.Skill.Name)
                .Select(item => new InternDetailSkillResponse
                {
                    Id = item.SkillId,
                    Name = item.Skill != null ? item.Skill.Name : string.Empty
                })
                .ToListAsync(cancellationToken);
        }

        var currentMission = await dbContext.Missions
            .AsNoTracking()
            .Where(item => item.InternId == id)
            .OrderByDescending(item => item.Status == DomainStatuses.Mission.Active)
            .ThenByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.Id,
                item.Title,
                item.Status,
                item.StartDate,
                item.EndDate,
                Type = item.InternshipType != null
                    ? item.InternshipType.Name
                    : (string.IsNullOrWhiteSpace(item.Level) ? null : item.Level),
                Department = item.Intern != null && item.Intern.Department != null
                    ? item.Intern.Department.Name
                    : null,
                SupervisorId = item.Supervisor != null ? (Guid?)item.Supervisor.Id : null,
                SupervisorFirstName = item.Supervisor != null ? item.Supervisor.FirstName : null,
                SupervisorLastName = item.Supervisor != null ? item.Supervisor.LastName : null,
                SupervisorEmail = item.Supervisor != null ? item.Supervisor.Email : null
            })
            .FirstOrDefaultAsync(cancellationToken);

        var specialty = string.IsNullOrWhiteSpace(profile?.Major)
            ? null
            : profile.Major;

        var level = string.IsNullOrWhiteSpace(profile?.CurrentYearOfStudy)
            ? null
            : profile.CurrentYearOfStudy;

        InternCurrentInternshipResponse? currentInternship = null;
        if (currentMission is not null)
        {
            InternCurrentInternshipSupervisorResponse? supervisor = null;
            if (currentMission.SupervisorId.HasValue)
            {
                supervisor = new InternCurrentInternshipSupervisorResponse
                {
                    Id = currentMission.SupervisorId.Value,
                    Name = $"{currentMission.SupervisorFirstName} {currentMission.SupervisorLastName}".Trim(),
                    Email = currentMission.SupervisorEmail ?? string.Empty
                };
            }

            currentInternship = new InternCurrentInternshipResponse
            {
                Id = currentMission.Id,
                Type = currentMission.Type,
                Department = currentMission.Department,
                StartDate = currentMission.StartDate,
                EndDate = currentMission.EndDate,
                Status = currentMission.Status,
                Supervisor = supervisor,
                Mission = new InternCurrentInternshipMissionResponse
                {
                    Id = currentMission.Id,
                    Title = currentMission.Title
                }
            };
        }

        var response = new InternDetailResponse
        {
            Id = intern.Id,
            FirstName = intern.FirstName,
            LastName = intern.LastName,
            FullName = $"{intern.FirstName} {intern.LastName}".Trim(),
            Email = intern.Email,
            Status = intern.VerificationStatus.ToString(),
            AccountStatus = intern.Status.ToString(),
            VerificationStatus = intern.VerificationStatus.ToString(),
            CvFileUrl = profile?.CvFileUrl,
            StartDate = profile?.StartDate ?? currentMission?.StartDate,
            EndDate = profile?.EndDate ?? currentMission?.EndDate,
            Phone = null,
            School = schoolName,
            Specialty = specialty,
            Level = level,
            Skills = skills,
            CurrentInternship = currentInternship
        };

        return Ok(response);
    }

    [HttpPut("{id:guid}/skills", Name = "UpdateInternSkills")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateInternSkills(
        Guid id,
        [FromBody] UpdateInternSkillsRequest request,
        CancellationToken cancellationToken)
    {
        var accessDeniedResult = await GetInternAccessDeniedResultAsync(id, cancellationToken);
        if (accessDeniedResult is not null)
        {
            return accessDeniedResult;
        }

        try
        {
            var skills = await internSkillsService.ReplaceSkillsAsync(
                id,
                request.SkillIds,
                UserContextHelper.ResolveCurrentUserId(User),
                UserContextHelper.ResolveCurrentActorName(User),
                cancellationToken);

            return Ok(new { data = skills });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Intern not found." });
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
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

    /// <summary>
    /// Downloads an intern's CV file.
    /// </summary>
    /// <remarks>
    /// This endpoint allows SuperAdmin, Admin, and Manager users to download an intern's CV file.
    /// The file is returned as a PDF attachment.
    /// </remarks>
    /// <param name="id">The intern's unique identifier.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    /// <returns>The CV file as a PDF.</returns>
    /// <response code="200">CV file returned successfully.</response>
    /// <response code="401">User not authenticated.</response>
    /// <response code="403">User not authorized (SuperAdmin/Admin/Manager only).</response>
    /// <response code="404">Intern not found or CV not available.</response>
    [HttpGet("{id:guid}/cv", Name = "DownloadInternCv")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadCv(Guid id, CancellationToken cancellationToken)
    {
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

        if (profile is null || string.IsNullOrWhiteSpace(profile.CvFileUrl))
        {
            return NotFound(new { message = "No CV on file" });
        }

        var relativePath = profile.CvFileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(environment.ContentRootPath, relativePath);

        if (!System.IO.File.Exists(absolutePath))
        {
            return NotFound(new { message = "No CV on file" });
        }

        // Response type: streamed file via PhysicalFileResult.
        return PhysicalFile(absolutePath, "application/pdf", enableRangeProcessing: true);
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
