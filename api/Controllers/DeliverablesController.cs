using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/deliverables")]
[Authorize(Roles = "Supervisor")]
public sealed class DeliverablesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
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

    [HttpPatch("{id:guid}/validate")]
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

        deliverable.Status = normalizedStatus;
        deliverable.SupervisorComment = string.IsNullOrWhiteSpace(request.Comment)
            ? null
            : request.Comment.Trim();

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
            Entity = $"deliverable:{deliverable.Id} status:{deliverable.Status}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = deliverable.Id,
            status = deliverable.Status
        });
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
