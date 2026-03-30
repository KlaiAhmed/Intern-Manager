using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize(Roles = "Intern")]
public sealed class InternDeliverablesController(AppDbContext dbContext, IWebHostEnvironment environment) : ControllerBase
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

    [HttpGet("intern/me/deliverables")]
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

    [HttpPost("deliverables/{id:guid}/submit")]
    [EnableRateLimiting("upload")]
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

        var hadPreviousSubmission = deliverable.SubmittedDate.HasValue || !string.IsNullOrWhiteSpace(deliverable.FileUrl);
        if (hadPreviousSubmission)
        {
            deliverable.Version = Math.Max(1, deliverable.Version + 1);
        }
        else if (deliverable.Version < 1)
        {
            deliverable.Version = 1;
        }

        deliverable.FileUrl = $"/uploads/deliverables/{storedFileName}".Replace('\\', '/');
        deliverable.SubmittedDate = DateTime.UtcNow;
        deliverable.Status = "submitted";

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

        return StatusCode(StatusCodes.Status201Created, new
        {
            id = deliverable.Id,
            version = deliverable.Version,
            status = "submitted"
        });
    }

    [HttpPatch("intern/me/deliverables/{id:guid}/progress")]
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

}

public sealed class SubmitDeliverableForm
{
    public IFormFile? File { get; init; }
}

public sealed class UpdateDeliverableProgressRequest
{
    public int Progress { get; init; }
}
