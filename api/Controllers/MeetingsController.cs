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
[Route("api/meetings")]
[Authorize(Roles = "Supervisor,Intern")]
public sealed class MeetingsController(AppDbContext dbContext, INotificationService notificationService) : ControllerBase
{
    [HttpGet(Name = "ListMeetings")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMeetings(
        [FromQuery] string? supervisorId = null,
        [FromQuery] string? internId = null,
        [FromQuery] bool upcoming = false,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        if (User.IsInRole("Intern"))
        {
            if (!UserContextHelper.IsCurrentInternScope(internId, currentUserId.Value))
            {
                return Forbid();
            }

            var upcomingMeeting = await dbContext.Meetings
                .AsNoTracking()
                .Where(meeting => meeting.InternId == currentUserId.Value)
                .Where(meeting => !upcoming || meeting.Date >= DateTime.UtcNow)
                .Include(meeting => meeting.Supervisor)
                .OrderBy(meeting => meeting.Date)
                .Select(meeting => new
                {
                    id = meeting.Id,
                    date = meeting.Date,
                    supervisorName = meeting.Supervisor != null
                        ? $"{meeting.Supervisor.FirstName} {meeting.Supervisor.LastName}".Trim()
                        : string.Empty,
                    notes = meeting.Notes
                })
                .FirstOrDefaultAsync(cancellationToken);

            return Ok(upcomingMeeting);
        }

        if (!User.IsInRole("Supervisor"))
        {
            return Forbid();
        }

        if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentUserId.Value))
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.SupervisorId == currentUserId.Value)
            .Include(meeting => meeting.Intern);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderByDescending(meeting => meeting.Date)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(meeting => new
            {
                id = meeting.Id,
                internId = meeting.InternId,
                internName = meeting.Intern != null
                    ? $"{meeting.Intern.FirstName} {meeting.Intern.LastName}".Trim()
                    : string.Empty,
                date = meeting.Date,
                notes = meeting.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    [HttpPost(Name = "CreateMeeting")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateMeeting([FromBody] CreateMeetingRequest request, CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (request.InternId == Guid.Empty)
        {
            return BadRequest(new { message = "internId is required." });
        }

        if (request.Date == default)
        {
            return BadRequest(new { message = "date is required." });
        }

        var scheduledDate = request.Date.Kind == DateTimeKind.Utc
            ? request.Date
            : request.Date.ToUniversalTime();

        if (scheduledDate <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Meeting date must be in the future." });
        }

        var internExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == request.InternId && user.Role == UserRole.Intern, cancellationToken);

        if (!internExists)
        {
            return BadRequest(new { message = "Intern not found." });
        }

        var assignedInternIds = await ResolveAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (!assignedInternIds.Contains(request.InternId))
        {
            return Forbid();
        }

        var conflictWindowStart = scheduledDate.AddMinutes(-59);
        var conflictWindowEnd = scheduledDate.AddMinutes(59);
        var hasConflict = await dbContext.Meetings
            .AsNoTracking()
            .AnyAsync(meeting => meeting.SupervisorId == currentSupervisorId.Value &&
                                 meeting.Date >= conflictWindowStart &&
                                 meeting.Date <= conflictWindowEnd,
                      cancellationToken);

        if (hasConflict)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Meeting slot conflicts with an existing meeting." });
        }

        var notes = request.Notes.Trim();

        var meeting = new Meeting
        {
            Id = Guid.NewGuid(),
            SupervisorId = currentSupervisorId.Value,
            InternId = request.InternId,
            Date = scheduledDate,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Meetings.Add(meeting);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentSupervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "meeting.create",
            Entity = $"meeting:{meeting.Id}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            meeting.InternId,
            "meeting.reminder",
            "New meeting scheduled",
            $"A meeting has been scheduled for {meeting.Date:u}.",
            $"meeting:{meeting.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = new
        {
            id = meeting.Id,
            date = meeting.Date
        };

        return CreatedAtAction(nameof(GetMeetingById), new { id = meeting.Id }, result);
    }

    [HttpGet("{id:guid}", Name = "GetMeetingById")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMeetingById(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var meeting = await dbContext.Meetings
            .AsNoTracking()
            .Include(item => item.Intern)
            .Include(item => item.Supervisor)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (meeting is null)
        {
            return NotFound();
        }

        if (User.IsInRole("Intern") && meeting.InternId != currentUserId.Value)
        {
            return Forbid();
        }

        if (User.IsInRole("Supervisor") && meeting.SupervisorId != currentUserId.Value)
        {
            return Forbid();
        }

        return Ok(new
        {
            id = meeting.Id,
            date = meeting.Date,
            notes = meeting.Notes,
            internId = meeting.InternId,
            internName = meeting.Intern != null
                ? $"{meeting.Intern.FirstName} {meeting.Intern.LastName}".Trim()
                : string.Empty,
            supervisorId = meeting.SupervisorId,
            supervisorName = meeting.Supervisor != null
                ? $"{meeting.Supervisor.FirstName} {meeting.Supervisor.LastName}".Trim()
                : string.Empty
        });
    }

    [HttpPatch("{id:guid}", Name = "UpdateMeeting")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateMeeting(Guid id, [FromBody] UpdateMeetingRequest request, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var meeting = await dbContext.Meetings
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == supervisorId.Value, cancellationToken);

        if (meeting is null)
        {
            return NotFound(new { message = "Meeting not found." });
        }

        var hasChanges = false;

        if (request.Date.HasValue)
        {
            var normalizedDate = request.Date.Value.Kind == DateTimeKind.Utc
                ? request.Date.Value
                : request.Date.Value.ToUniversalTime();

            if (normalizedDate <= DateTime.UtcNow)
            {
                return BadRequest(new { message = "Meeting date must be in the future." });
            }

            if (meeting.Date != normalizedDate)
            {
                var conflictWindowStart = normalizedDate.AddMinutes(-59);
                var conflictWindowEnd = normalizedDate.AddMinutes(59);
                var hasConflict = await dbContext.Meetings
                    .AsNoTracking()
                    .AnyAsync(item => item.Id != meeting.Id &&
                                      item.SupervisorId == supervisorId.Value &&
                                      item.Date >= conflictWindowStart &&
                                      item.Date <= conflictWindowEnd,
                              cancellationToken);

                if (hasConflict)
                {
                    return StatusCode(StatusCodes.Status409Conflict, new { message = "Meeting slot conflicts with an existing meeting." });
                }

                meeting.Date = normalizedDate;
                hasChanges = true;
            }
        }

        if (request.Notes is not null)
        {
            var normalizedNotes = request.Notes.Trim();
            if (!string.Equals(meeting.Notes, normalizedNotes, StringComparison.Ordinal))
            {
                meeting.Notes = normalizedNotes;
                hasChanges = true;
            }
        }

        if (!hasChanges)
        {
            return Ok(new
            {
                id = meeting.Id,
                date = meeting.Date,
                notes = meeting.Notes
            });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "meeting.update",
            Entity = $"meeting:{meeting.Id}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            meeting.InternId,
            "meeting.reminder",
            "Meeting updated",
            $"Your meeting has been updated for {meeting.Date:u}.",
            $"meeting:{meeting.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = meeting.Id,
            date = meeting.Date,
            notes = meeting.Notes
        });
    }

    [HttpDelete("{id:guid}", Name = "DeleteMeeting")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteMeeting(Guid id, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var meeting = await dbContext.Meetings
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == supervisorId.Value, cancellationToken);

        if (meeting is null)
        {
            return NotFound(new { message = "Meeting not found." });
        }

        dbContext.Meetings.Remove(meeting);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "meeting.delete",
            Entity = $"meeting:{meeting.Id}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            meeting.InternId,
            "meeting.cancelled",
            "Meeting cancelled",
            "A scheduled meeting has been cancelled by your supervisor.",
            $"meeting:{meeting.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
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
}

public sealed class CreateMeetingRequest
{
    public Guid InternId { get; init; }

    public DateTime Date { get; init; }

    public string Notes { get; init; } = string.Empty;
}

public sealed class UpdateMeetingRequest
{
    public DateTime? Date { get; init; }

    public string? Notes { get; init; }
}
