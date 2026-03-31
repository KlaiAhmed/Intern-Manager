using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public sealed class TasksController(AppDbContext dbContext, INotificationService notificationService) : ControllerBase
{
    [HttpGet("/api/intern/me/tasks", Name = "ListMyTasks")]
    [Authorize(Roles = "Intern")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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

    [HttpPost("/api/intern/me/tasks/sync", Name = "SyncMyTasks")]
    [Authorize(Roles = "Intern")]
    [ProducesResponseType(typeof(ActionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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
            return Ok(new ActionResponse
            {
                Success = true,
                Message = "No tasks to synchronize."
            });
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
        return Ok(new ActionResponse
        {
            Success = true,
            Message = $"Created {createdCount} task(s)."
        });
    }

    [HttpPatch("{id:guid}/complete", Name = "CompleteTask")]
    [Authorize(Roles = "Intern")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    [HttpPost(Name = "AssignTask")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AssignTask([FromBody] AssignTaskRequest request, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (request.InternId == Guid.Empty)
        {
            return BadRequest(new { message = "internId is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "title is required." });
        }

        var internExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == request.InternId && user.Role == UserRole.Intern, cancellationToken);

        if (!internExists)
        {
            return BadRequest(new { message = "Intern not found." });
        }

        var canAssign = await CanSupervisorAssignInternAsync(supervisorId.Value, request.InternId, cancellationToken);
        if (!canAssign)
        {
            return Forbid();
        }

        Guid? deliverableId = null;
        if (request.DeliverableId.HasValue && request.DeliverableId.Value != Guid.Empty)
        {
            var deliverable = await dbContext.Deliverables
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == request.DeliverableId.Value && item.SupervisorId == supervisorId.Value, cancellationToken);

            if (deliverable is null)
            {
                return BadRequest(new { message = "Deliverable not found for current supervisor." });
            }

            if (deliverable.InternId.HasValue && deliverable.InternId.Value != request.InternId)
            {
                return BadRequest(new { message = "Deliverable is assigned to another intern." });
            }

            deliverableId = deliverable.Id;
        }

        var normalizedDueDate = request.DueDate.HasValue
            ? (request.DueDate.Value.Kind == DateTimeKind.Utc
                ? request.DueDate.Value
                : request.DueDate.Value.ToUniversalTime())
            : (DateTime?)null;

        var task = new InternTask
        {
            Id = Guid.NewGuid(),
            InternId = request.InternId,
            DeliverableId = deliverableId,
            Title = request.Title.Trim(),
            DueDate = normalizedDueDate,
            IsComplete = false,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.InternTasks.Add(task);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.assign",
            Entity = $"task:{task.Id} intern:{task.InternId}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            task.InternId,
            "task.assigned",
            "New task assigned",
            $"Task '{task.Title}' has been assigned to you.",
            $"task:{task.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Created($"/api/tasks/{task.Id}", new
        {
            id = task.Id,
            internId = task.InternId,
            title = task.Title,
            dueDate = task.DueDate,
            isComplete = task.IsComplete
        });
    }

    private async Task<bool> CanSupervisorAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken)
    {
        var relatedSupervisorIds = new HashSet<Guid>();

        relatedSupervisorIds.UnionWith(await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.InternId == internId)
            .Select(mission => mission.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        relatedSupervisorIds.UnionWith(await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.InternId == internId)
            .Select(deliverable => deliverable.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        relatedSupervisorIds.UnionWith(await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.InternId == internId)
            .Select(evaluation => evaluation.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        relatedSupervisorIds.UnionWith(await dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.InternId == internId)
            .Select(meeting => meeting.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        return relatedSupervisorIds.Count == 0 || relatedSupervisorIds.Contains(supervisorId);
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

public sealed class AssignTaskRequest
{
    public Guid InternId { get; init; }

    public Guid? DeliverableId { get; init; }

    public string Title { get; init; } = string.Empty;

    public DateTime? DueDate { get; init; }
}
