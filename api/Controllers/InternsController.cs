using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
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
    INotificationService notificationService) : ControllerBase
{
    private const long MaxCvUploadBytes = 5 * 1024 * 1024;

    [HttpGet(Name = "ListInterns")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListInterns(
        [FromQuery] string? status = null,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        InternLifecycleStatus? parsedStatus = null;

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!InternLifecycleStateMachine.TryParse(status, out var parsed))
            {
                return BadRequest(new { message = "Invalid intern lifecycle status filter." });
            }

            parsedStatus = parsed;
        }

        var safeLimit = Math.Clamp(limit, 1, 500);

        var query = dbContext.InternProfiles
            .AsNoTracking()
            .Include(profile => profile.Intern)
            .Where(profile => profile.Intern != null && profile.Intern.Role == UserRole.Intern)
            .AsQueryable();

        if (parsedStatus.HasValue)
        {
            query = query.Where(profile => profile.Status == parsedStatus.Value);
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
                status = profile.Status.ToString(),
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
        var canAccess = CanAccessInternResource(id, out var unauthorizedResult);
        if (!canAccess)
        {
            return unauthorizedResult!;
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

        var status = profile?.Status ?? InternLifecycleStatus.INCOMPLETE;

        return Ok(new
        {
            id = intern.Id,
            firstName = intern.FirstName,
            lastName = intern.LastName,
            fullName = $"{intern.FirstName} {intern.LastName}".Trim(),
            email = intern.Email,
            status = status.ToString(),
            cvFileUrl = profile?.CvFileUrl,
            startDate = profile?.StartDate,
            endDate = profile?.EndDate
        });
    }

    [HttpGet("{id:guid}/status", Name = "GetInternStatus")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInternStatus(Guid id, CancellationToken cancellationToken)
    {
        var canAccess = CanAccessInternResource(id, out var unauthorizedResult);
        if (!canAccess)
        {
            return unauthorizedResult!;
        }

        var internExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == id && user.Role == UserRole.Intern, cancellationToken);

        if (!internExists)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var profile = await dbContext.InternProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.InternId == id, cancellationToken);

        var status = profile?.Status ?? InternLifecycleStatus.INCOMPLETE;

        return Ok(new
        {
            id,
            status = status.ToString()
        });
    }

    [HttpPost("{id:guid}/upload-cv", Name = "UploadInternCv")]
    [Authorize(Roles = "Intern")]
    [EnableRateLimiting("upload")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UploadCv(Guid id, [FromForm] UploadInternCvForm request, CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        if (currentUserId.Value != id)
        {
            return Forbid();
        }

        var intern = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Id == id && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new { message = "File is required." });
        }

        if (request.File.Length > MaxCvUploadBytes)
        {
            return BadRequest(new { message = "CV exceeds the 5 MB limit." });
        }

        var extension = Path.GetExtension(request.File.FileName);
        if (!string.Equals(extension, ".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only PDF files are allowed." });
        }

        var contentType = request.File.ContentType?.Trim();
        if (!string.Equals(contentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Invalid CV content type." });
        }

        var profile = await EnsureProfileAsync(id, cancellationToken);

        if (profile.Status is InternLifecycleStatus.ACTIVE or InternLifecycleStatus.COMPLETED or InternLifecycleStatus.ARCHIVED)
        {
            return Conflict(new { message = $"CV upload is not allowed when intern status is {profile.Status}." });
        }

        if (profile.Status == InternLifecycleStatus.INCOMPLETE)
        {
            profile.Status = InternLifecycleStatus.PENDING;
        }

        profile.StartDate = null;
        profile.EndDate = null;

        var uploadsDirectory = Path.Combine(environment.ContentRootPath, "uploads", "cv");
        Directory.CreateDirectory(uploadsDirectory);

        if (!string.IsNullOrWhiteSpace(profile.CvFileUrl))
        {
            TryDeleteExistingFile(profile.CvFileUrl, uploadsDirectory);
        }

        var storedFileName = $"{id}_{DateTime.UtcNow:yyyyMMddHHmmssfff}.pdf";
        var destinationPath = Path.Combine(uploadsDirectory, storedFileName);

        await using (var stream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await request.File.CopyToAsync(stream, cancellationToken);
        }

        profile.CvFileUrl = $"/uploads/cv/{storedFileName}";

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentUserId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "intern.cv.upload",
            Entity = $"intern:{id}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            id,
            "intern.cv.submitted",
            "CV submitted",
            "Your CV has been submitted successfully. You will be notified when a supervisor assigns you to a project.",
            $"intern:{id}");

        notificationService.QueueNotification(
            id,
            "intern.profile.pending-assignment",
            "Profile awaiting assignment",
            "Your profile is awaiting assignment",
            $"intern:{id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetInternStatus), new { id }, new
        {
            id,
            status = profile.Status.ToString(),
            cvFileUrl = profile.CvFileUrl
        });
    }

    private bool CanAccessInternResource(Guid internId, out IActionResult? deniedResult)
    {
        deniedResult = null;

        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            deniedResult = Unauthorized();
            return false;
        }

        var currentRole = UserContextHelper.ResolveCurrentUserRole(User);
        var canReadAnyIntern = currentRole is UserRole.SuperAdmin or UserRole.Admin or UserRole.Manager or UserRole.Supervisor;
        var isSelfIntern = currentRole == UserRole.Intern && currentUserId.Value == internId;

        if (!canReadAnyIntern && !isSelfIntern)
        {
            deniedResult = Forbid();
            return false;
        }

        return true;
    }

    private async Task<InternProfile> EnsureProfileAsync(Guid internId, CancellationToken cancellationToken)
    {
        var profile = await dbContext.InternProfiles
            .FirstOrDefaultAsync(item => item.InternId == internId, cancellationToken);

        if (profile is not null)
        {
            return profile;
        }

        profile = new InternProfile
        {
            Id = Guid.NewGuid(),
            InternId = internId,
            School = string.Empty,
            Specialty = string.Empty,
            CompetenciesJson = "[]",
            Experience = string.Empty,
            CvFileUrl = null,
            Status = InternLifecycleStatus.INCOMPLETE,
            StartDate = null,
            EndDate = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.InternProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return profile;
    }

    private static void TryDeleteExistingFile(string cvFileUrl, string uploadsDirectory)
    {
        var fileName = Path.GetFileName(cvFileUrl);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return;
        }

        var path = Path.Combine(uploadsDirectory, fileName);
        if (System.IO.File.Exists(path))
        {
            System.IO.File.Delete(path);
        }
    }
}
