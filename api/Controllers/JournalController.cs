using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/intern/me/journal")]
[Authorize(Roles = "Intern")]
public sealed class JournalController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet(Name = "ListJournalEntries")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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

    [HttpPost(Name = "CreateJournalEntry")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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

        var result = new
        {
            id = entry.Id,
            content = entry.Content,
            createdAt = entry.CreatedAt
        };

        return CreatedAtAction(nameof(GetJournalEntryById), new { id = entry.Id }, result);
    }

    [HttpGet("{id:guid}", Name = "GetJournalEntryById")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJournalEntryById(Guid id, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var entry = await dbContext.JournalEntries
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (entry is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            id = entry.Id,
            content = entry.Content,
            createdAt = entry.CreatedAt
        });
    }

    [HttpPatch("{id:guid}", Name = "UpdateJournalEntry")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateJournalEntry(Guid id, [FromBody] UpdateJournalEntryRequest request, CancellationToken cancellationToken)
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

        var entry = await dbContext.JournalEntries
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (entry is null)
        {
            return NotFound(new { message = "Journal entry not found." });
        }

        entry.Content = request.Content.Trim();

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "journal.update",
            Entity = $"journal:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = entry.Id,
            content = entry.Content,
            createdAt = entry.CreatedAt
        });
    }

    [HttpDelete("{id:guid}", Name = "DeleteJournalEntry")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteJournalEntry(Guid id, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var entry = await dbContext.JournalEntries
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (entry is null)
        {
            return NotFound(new { message = "Journal entry not found." });
        }

        dbContext.JournalEntries.Remove(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "journal.delete",
            Entity = $"journal:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

public sealed class AddJournalEntryRequest
{
    public string Content { get; init; } = string.Empty;
}

public sealed class UpdateJournalEntryRequest
{
    public string Content { get; init; } = string.Empty;
}
