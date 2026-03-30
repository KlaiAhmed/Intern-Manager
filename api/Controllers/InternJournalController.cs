using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/intern/me/journal")]
[Authorize(Roles = "Intern")]
public sealed class InternJournalController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMyJournalEntries([FromQuery] int limit = 10, CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var safeLimit = Math.Clamp(limit, 1, 100);

        var data = await dbContext.JournalEntries
            .AsNoTracking()
            .Where(entry => entry.InternId == internId.Value)
            .OrderByDescending(entry => entry.CreatedAt)
            .Take(safeLimit)
            .Select(entry => new
            {
                id = entry.Id,
                content = entry.Content,
                createdAt = entry.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data });
    }

    [HttpPost]
    [EnableRateLimiting("write-heavy")]
    public async Task<IActionResult> AddJournalEntry([FromBody] AddJournalEntryRequest request, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Content))
        {
            return BadRequest(new { message = "Content is required." });
        }

        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            InternId = internId.Value,
            Content = request.Content.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.JournalEntries.Add(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "journal.create",
            Entity = $"journal:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new
        {
            id = entry.Id,
            content = entry.Content,
            createdAt = entry.CreatedAt
        });
    }
}

public sealed class AddJournalEntryRequest
{
    public string Content { get; init; } = string.Empty;
}
