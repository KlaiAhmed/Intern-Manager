using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/deliverables")]
[Authorize]
public sealed class DeliverablesController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    INotificationService notificationService) : ControllerBase
{
    private const long MaxUploadBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".doc",
        ".docx",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg"
    };

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "image/png",
        "image/jpeg"
    };

    [HttpGet(Name = "ListDeliverables")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDeliverables(
        [FromQuery] string? status = null,
        [FromQuery] string? supervisorId = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentSupervisorId.Value))
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == currentSupervisorId.Value)
            .Include(deliverable => deliverable.Intern)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();

            query = normalizedStatus switch
            {
                "pending" => query.Where(deliverable => deliverable.Status == "pending" || deliverable.Status == "submitted"),
                _ => query.Where(deliverable => deliverable.Status == normalizedStatus)
            };
        }

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderByDescending(deliverable => deliverable.SubmittedDate)
            .ThenByDescending(deliverable => deliverable.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(deliverable => new
            {
                id = deliverable.Id,
                title = deliverable.Title,
                internId = deliverable.InternId,
                internName = deliverable.Intern != null
                    ? $"{deliverable.Intern.FirstName} {deliverable.Intern.LastName}".Trim()
                    : string.Empty,
                submittedDate = deliverable.SubmittedDate,
                fileUrl = string.IsNullOrWhiteSpace(deliverable.FileUrl)
                    ? "#"
                    : deliverable.FileUrl,
                version = deliverable.Version
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    [HttpGet("/api/intern/me/deliverables", Name = "ListMyDeliverables")]
    [Authorize(Roles = "Intern")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyDeliverables(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.InternId == internId.Value);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderBy(deliverable => deliverable.DueDate)
            .ThenByDescending(deliverable => deliverable.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(deliverable => new
            {
                id = deliverable.Id,
                title = deliverable.Title,
                dueDate = deliverable.DueDate,
                status = NormalizeStatusForIntern(deliverable.Status),
                version = deliverable.Version,
                supervisorComment = deliverable.SupervisorComment,
                progress = Math.Clamp(deliverable.Progress, 0, 100)
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    [HttpGet("{id:guid}/file", Name = "DownloadDeliverableFile")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadDeliverableFile(
        Guid id,
        [FromQuery] int? version = null,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var deliverable = await dbContext.Deliverables
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var isSupervisorScope = User.IsInRole("Supervisor") && deliverable.SupervisorId == currentUserId.Value;
        var isInternScope = User.IsInRole("Intern") && deliverable.InternId == currentUserId.Value;

        if (!isAdminScope && !isSupervisorScope && !isInternScope)
        {
            return Forbid();
        }

        DeliverableVersion? selectedVersion = null;
        if (version.HasValue)
        {
            selectedVersion = await dbContext.DeliverableVersions
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    item => item.DeliverableId == id && item.VersionNumber == version.Value,
                    cancellationToken);

            if (selectedVersion is null)
            {
                return NotFound(new { message = "Requested deliverable version was not found." });
            }
        }
        else
        {
            selectedVersion = await dbContext.DeliverableVersions
                .AsNoTracking()
                .Where(item => item.DeliverableId == id)
                .OrderByDescending(item => item.VersionNumber)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var fileUrl = selectedVersion?.FileUrl ?? deliverable.FileUrl;
        if (string.IsNullOrWhiteSpace(fileUrl))
        {
            return NotFound(new { message = "No file is associated with this deliverable." });
        }

        var relativePath = fileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(environment.ContentRootPath, relativePath);

        if (!System.IO.File.Exists(absolutePath))
        {
            return NotFound(new { message = "File not found in storage." });
        }

        var contentTypeProvider = new FileExtensionContentTypeProvider();
        if (!contentTypeProvider.TryGetContentType(absolutePath, out var contentType))
        {
            contentType = "application/octet-stream";
        }

        var downloadName = Path.GetFileName(absolutePath);
        return PhysicalFile(absolutePath, contentType, downloadName, enableRangeProcessing: true);
    }

    [HttpPost("{id:guid}/submit", Name = "SubmitDeliverable")]
    [Authorize(Roles = "Intern")]
    [EnableRateLimiting("upload")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitDeliverable(
        Guid id,
        [FromForm] SubmitDeliverableForm request,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new { message = "File is required." });
        }

        if (request.File.Length > MaxUploadBytes)
        {
            return BadRequest(new { message = "File exceeds the 10 MB limit." });
        }

        var fileExtension = Path.GetExtension(request.File.FileName);
        if (string.IsNullOrWhiteSpace(fileExtension) || !AllowedExtensions.Contains(fileExtension))
        {
            return BadRequest(new { message = "File extension is not allowed." });
        }

        if (string.IsNullOrWhiteSpace(request.File.ContentType) || !AllowedMimeTypes.Contains(request.File.ContentType))
        {
            return BadRequest(new { message = "File content type is not allowed." });
        }

        var deliverable = await dbContext.Deliverables
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        var uploadsDirectory = Path.Combine(environment.ContentRootPath, "uploads", "deliverables");
        Directory.CreateDirectory(uploadsDirectory);

        var storedFileName = $"{deliverable.Id}_{DateTime.UtcNow:yyyyMMddHHmmssfff}{fileExtension}";
        var destinationPath = Path.Combine(uploadsDirectory, storedFileName);

        await using (var stream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await request.File.CopyToAsync(stream, cancellationToken);
        }

        var latestVersionNumber = await dbContext.DeliverableVersions
            .AsNoTracking()
            .Where(version => version.DeliverableId == deliverable.Id)
            .Select(version => (int?)version.VersionNumber)
            .MaxAsync(cancellationToken) ?? 0;

        var hadPreviousSubmission = deliverable.SubmittedDate.HasValue || !string.IsNullOrWhiteSpace(deliverable.FileUrl);
        var nextVersionNumber = hadPreviousSubmission
            ? Math.Max(Math.Max(1, deliverable.Version) + 1, latestVersionNumber + 1)
            : Math.Max(Math.Max(1, deliverable.Version), latestVersionNumber + 1);

        dbContext.DeliverableVersions.Add(new DeliverableVersion
        {
            Id = Guid.NewGuid(),
            DeliverableId = deliverable.Id,
            VersionNumber = nextVersionNumber,
            FileUrl = $"/uploads/deliverables/{storedFileName}".Replace('\\', '/'),
            Status = "submitted",
            SupervisorComment = null,
            SubmittedAt = DateTime.UtcNow
        });

        deliverable.Version = nextVersionNumber;
        deliverable.FileUrl = $"/uploads/deliverables/{storedFileName}".Replace('\\', '/');
        deliverable.SubmittedDate = DateTime.UtcNow;
        deliverable.Status = "submitted";
        deliverable.SupervisorComment = null;

        var linkedTasks = await dbContext.InternTasks
            .Where(task => task.DeliverableId == deliverable.Id && task.InternId == internId.Value)
            .ToListAsync(cancellationToken);

        foreach (var task in linkedTasks)
        {
            task.IsComplete = true;
            task.CompletedAt = DateTime.UtcNow;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "deliverable.submit",
            Entity = $"deliverable:{deliverable.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = new
        {
            id = deliverable.Id,
            version = deliverable.Version,
            status = "submitted"
        };

        return Created($"/api/deliverables/{deliverable.Id}", result);
    }

    [HttpPatch("/api/intern/me/deliverables/{id:guid}/progress", Name = "UpdateDeliverableProgress")]
    [Authorize(Roles = "Intern")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDeliverableProgress(
        Guid id,
        [FromBody] UpdateDeliverableProgressRequest request,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        if (request.Progress < 0 || request.Progress > 100)
        {
            return BadRequest(new { message = "progress must be between 0 and 100." });
        }

        var deliverable = await dbContext.Deliverables
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        deliverable.Progress = request.Progress;

        var linkedTasks = await dbContext.InternTasks
            .Where(task => task.DeliverableId == deliverable.Id && task.InternId == internId.Value)
            .ToListAsync(cancellationToken);

        foreach (var task in linkedTasks)
        {
            var isComplete = request.Progress >= 100;
            task.IsComplete = isComplete;
            task.CompletedAt = isComplete ? DateTime.UtcNow : null;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "deliverable.progress.update",
            Entity = $"deliverable:{deliverable.Id} progress:{deliverable.Progress}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = deliverable.Id,
            progress = deliverable.Progress
        });
    }

    [HttpPatch("{id:guid}/validate", Name = "ValidateDeliverable")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ValidateDeliverable(
        Guid id,
        [FromBody] ValidateDeliverableRequest request,
        CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var normalizedStatus = NormalizeValidationStatus(request.Status, request.Action);
        if (normalizedStatus is null)
        {
            return BadRequest(new { message = "Status must be 'accepted' or 'rejected'." });
        }

        var deliverable = await dbContext.Deliverables
            .FirstOrDefaultAsync(
                item => item.Id == id && item.SupervisorId == currentSupervisorId.Value,
                cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        var currentStatus = deliverable.Status.Trim().ToLowerInvariant();
        if (currentStatus != "submitted")
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Only submitted deliverables can be validated." });
        }

        var latestVersion = await dbContext.DeliverableVersions
            .Where(item => item.DeliverableId == deliverable.Id)
            .OrderByDescending(item => item.VersionNumber)
            .FirstOrDefaultAsync(cancellationToken);

        if (latestVersion is null)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "No submission version was found for this deliverable." });
        }

        deliverable.Status = normalizedStatus;
        deliverable.SupervisorComment = string.IsNullOrWhiteSpace(request.Comment)
            ? null
            : request.Comment.Trim();

        latestVersion.Status = normalizedStatus;
        latestVersion.SupervisorComment = deliverable.SupervisorComment;
        latestVersion.ValidatedAt = DateTime.UtcNow;

        if (!deliverable.SubmittedDate.HasValue)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Submitted date is required before validation." });
        }

        if (normalizedStatus == "accepted")
        {
            deliverable.Progress = 100;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentSupervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "deliverable.validate",
            Entity = $"deliverable:{deliverable.Id} version:{latestVersion.VersionNumber} status:{deliverable.Status}",
            Timestamp = DateTime.UtcNow
        });

        if (deliverable.InternId.HasValue)
        {
            var title = normalizedStatus == "accepted" ? "Deliverable accepted" : "Deliverable rejected";
            var message = normalizedStatus == "accepted"
                ? $"Your deliverable '{deliverable.Title}' (v{latestVersion.VersionNumber}) was accepted."
                : $"Your deliverable '{deliverable.Title}' (v{latestVersion.VersionNumber}) was rejected.";

            notificationService.QueueNotification(
                deliverable.InternId.Value,
                "deliverable.validation",
                title,
                message,
                $"deliverable:{deliverable.Id}:v{latestVersion.VersionNumber}");
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = deliverable.Id,
            status = deliverable.Status
        });
    }

    private static string NormalizeStatusForIntern(string rawStatus)
    {
        var normalizedStatus = rawStatus.Trim().ToLowerInvariant();

        return normalizedStatus switch
        {
            "pending" => "not_submitted",
            "submitted" => "submitted",
            "accepted" => "accepted",
            "rejected" => "rejected",
            _ => normalizedStatus
        };
    }

    private static string? NormalizeValidationStatus(string? status, string? action)
    {
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLowerInvariant();
            return normalized is "accepted" or "rejected"
                ? normalized
                : null;
        }

        if (string.IsNullOrWhiteSpace(action))
        {
            return null;
        }

        var normalizedAction = action.Trim().ToLowerInvariant();
        return normalizedAction switch
        {
            "accept" or "accepted" => "accepted",
            "reject" or "rejected" => "rejected",
            _ => null
        };
    }

}

public sealed class ValidateDeliverableRequest
{
    public string Status { get; init; } = string.Empty;

    public string Action { get; init; } = string.Empty;

    public string Comment { get; init; } = string.Empty;
}

public sealed class SubmitDeliverableForm
{
    public IFormFile? File { get; init; }
}

public sealed class UpdateDeliverableProgressRequest
{
    public int Progress { get; init; }
}
