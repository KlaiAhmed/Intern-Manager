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
[Route("api/stages")]
[Authorize]
public sealed class StagesController(AppDbContext dbContext, INotificationService notificationService) : ControllerBase
{
    [HttpPost("assign", Name = "AssignStage")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Assign([FromBody] AssignStageRequest request, CancellationToken cancellationToken)
    {
        if (request.MissionId == Guid.Empty)
        {
            return BadRequest(new { message = "missionId is required." });
        }

        if (request.InternId == Guid.Empty)
        {
            return BadRequest(new { message = "internId is required." });
        }

        if (request.StartDate == default || request.EndDate == default)
        {
            return BadRequest(new { message = "startDate and endDate are required." });
        }

        var startDate = NormalizeUtc(request.StartDate);
        var endDate = NormalizeUtc(request.EndDate);

        if (endDate < startDate)
        {
            return BadRequest(new { message = "endDate must be greater than or equal to startDate." });
        }

        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized();
        }

        var mission = await dbContext.Missions
            .FirstOrDefaultAsync(item => item.Id == request.MissionId, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Mission not found." });
        }

        if (User.IsInRole("Supervisor") && mission.SupervisorId != actorUserId.Value)
        {
            return Forbid();
        }

        var intern = await dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == request.InternId && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var profile = await EnsureProfileAsync(request.InternId, cancellationToken);

        if (intern.VerificationStatus != InternVerificationStatus.PENDING)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = $"Illegal transition: only PENDING interns can be assigned to a stage. Current status is {intern.VerificationStatus}."
            });
        }

        if (mission.InternId.HasValue && mission.InternId.Value != request.InternId)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = "Mission is already assigned to another intern. Unassign it first before assigning a different intern."
            });
        }

        var hasActiveMissionElsewhere = await dbContext.Missions
            .AsNoTracking()
            .AnyAsync(item => item.Id != mission.Id &&
                              item.InternId == request.InternId &&
                              item.Status == "active", cancellationToken);

        if (hasActiveMissionElsewhere)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = "Intern already has an active stage assignment."
            });
        }

        mission.InternId = request.InternId;
        var previousMissionStatus = mission.Status;
        mission.Status = "active";

        var deliverables = await dbContext.Deliverables
            .Where(item => item.MissionId == mission.Id)
            .ToListAsync(cancellationToken);

        foreach (var deliverable in deliverables)
        {
            deliverable.InternId = request.InternId;
        }

        var deliverableIds = deliverables.Select(item => item.Id).ToList();
        if (deliverableIds.Count > 0)
        {
            var linkedTasks = await dbContext.InternTasks
                .Where(task => task.DeliverableId.HasValue && deliverableIds.Contains(task.DeliverableId.Value))
                .ToListAsync(cancellationToken);

            if (linkedTasks.Count > 0)
            {
                dbContext.InternTasks.RemoveRange(linkedTasks);
            }

            foreach (var deliverable in deliverables)
            {
                var isComplete = deliverable.Progress >= 100 ||
                                 deliverable.Status.Equals("accepted", StringComparison.OrdinalIgnoreCase);

                dbContext.InternTasks.Add(new InternTask
                {
                    Id = Guid.NewGuid(),
                    InternId = request.InternId,
                    DeliverableId = deliverable.Id,
                    Title = deliverable.Title,
                    DueDate = deliverable.DueDate,
                    IsComplete = isComplete,
                    CompletedAt = isComplete ? DateTime.UtcNow : null,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        intern.VerificationStatus = InternVerificationStatus.ACTIVE;
        profile.StartDate = startDate;
        profile.EndDate = endDate;

        dbContext.MissionHistoryEntries.Add(new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = mission.Id,
            Field = "internId",
            OldValue = null,
            NewValue = request.InternId.ToString(),
            ChangedByUserId = actorUserId,
            ChangedBy = UserContextHelper.ResolveCurrentActorName(User),
            ChangedAt = DateTime.UtcNow
        });

        dbContext.MissionHistoryEntries.Add(new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = mission.Id,
            Field = "status",
            OldValue = previousMissionStatus,
            NewValue = "active",
            ChangedByUserId = actorUserId,
            ChangedBy = UserContextHelper.ResolveCurrentActorName(User),
            ChangedAt = DateTime.UtcNow
        });

        dbContext.MissionHistoryEntries.Add(new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = mission.Id,
            Field = "startDate",
            OldValue = null,
            NewValue = startDate.ToString("O"),
            ChangedByUserId = actorUserId,
            ChangedBy = UserContextHelper.ResolveCurrentActorName(User),
            ChangedAt = DateTime.UtcNow
        });

        dbContext.MissionHistoryEntries.Add(new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = mission.Id,
            Field = "endDate",
            OldValue = null,
            NewValue = endDate.ToString("O"),
            ChangedByUserId = actorUserId,
            ChangedBy = UserContextHelper.ResolveCurrentActorName(User),
            ChangedAt = DateTime.UtcNow
        });

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "stage.assign",
            Entity = $"mission:{mission.Id} intern:{request.InternId}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            request.InternId,
            "intern.status.active",
            "Internship activated",
            "You have been assigned to a project. Your internship status is now ACTIVE.",
            $"mission:{mission.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Created($"/api/interns/{request.InternId}/status", new
        {
            missionId = mission.Id,
            internId = request.InternId,
            status = intern.VerificationStatus.ToString(),
            verificationStatus = intern.VerificationStatus.ToString(),
            startDate,
            endDate
        });
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
            UniversityId = null,
            Major = string.Empty,
            CurrentYearOfStudy = string.Empty,
            ExpectedGraduationDate = null,
            WorkPreference = null,
            CvFileUrl = null,
            StartDate = null,
            EndDate = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.InternProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return profile;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind == DateTimeKind.Utc
            ? value
            : value.ToUniversalTime();
    }
}

public sealed class AssignStageRequest
{
    public Guid MissionId { get; init; }

    public Guid InternId { get; init; }

    public DateTime StartDate { get; init; }

    public DateTime EndDate { get; init; }
}
