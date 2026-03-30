using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize(Roles = "Intern")]
public sealed class InternTasksController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("intern/me/tasks")]
    public async Task<IActionResult> GetMyTasks(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var isIntern = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (!isIntern)
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.InternTasks
            .AsNoTracking()
            .Where(task => task.InternId == internId.Value);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderBy(task => task.IsComplete)
            .ThenBy(task => task.DueDate)
            .ThenBy(task => task.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(task => new
            {
                id = task.Id,
                title = task.Title,
                dueDate = task.DueDate,
                isComplete = task.IsComplete,
                completed = task.IsComplete
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    [HttpPost("intern/me/tasks/sync")]
    public async Task<IActionResult> SyncTasksFromDeliverables(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var createdCount = await EnsureTasksFromDeliverablesAsync(internId.Value, cancellationToken);
        if (createdCount == 0)
        {
            return Ok(new { created = 0 });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.sync",
            Entity = $"intern:{internId.Value} created:{createdCount}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new { created = createdCount });
    }

    [HttpPatch("tasks/{id:guid}/complete")]
    public async Task<IActionResult> CompleteTask(Guid id, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var task = await dbContext.InternTasks
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (task is null)
        {
            return NotFound(new { message = "Task not found." });
        }

        task.IsComplete = true;
        task.CompletedAt = DateTime.UtcNow;

        if (task.DeliverableId.HasValue)
        {
            var deliverable = await dbContext.Deliverables
                .FirstOrDefaultAsync(item => item.Id == task.DeliverableId.Value, cancellationToken);

            if (deliverable is not null)
            {
                deliverable.Progress = 100;
            }
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.complete",
            Entity = $"task:{task.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = task.Id,
            isComplete = true,
            completed = true
        });
    }

    private async Task<int> EnsureTasksFromDeliverablesAsync(Guid internId, CancellationToken cancellationToken)
    {
        var existingDeliverableIds = await dbContext.InternTasks
            .AsNoTracking()
            .Where(task => task.InternId == internId && task.DeliverableId.HasValue)
            .Select(task => task.DeliverableId!.Value)
            .ToListAsync(cancellationToken);

        var existingDeliverableSet = existingDeliverableIds.ToHashSet();

        var missingDeliverables = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.InternId == internId && !existingDeliverableSet.Contains(deliverable.Id))
            .Select(deliverable => new
            {
                deliverable.Id,
                deliverable.Title,
                deliverable.DueDate,
                deliverable.Progress,
                deliverable.Status
            })
            .ToListAsync(cancellationToken);

        if (missingDeliverables.Count == 0)
        {
            return 0;
        }

        foreach (var deliverable in missingDeliverables)
        {
            var isComplete = deliverable.Progress >= 100 ||
                             deliverable.Status.Equals("accepted", StringComparison.OrdinalIgnoreCase);

            dbContext.InternTasks.Add(new InternTask
            {
                Id = Guid.NewGuid(),
                InternId = internId,
                DeliverableId = deliverable.Id,
                Title = deliverable.Title,
                DueDate = deliverable.DueDate,
                IsComplete = isComplete,
                CompletedAt = isComplete ? DateTime.UtcNow : null,
                CreatedAt = DateTime.UtcNow
            });
        }

        return missingDeliverables.Count;
    }
}
