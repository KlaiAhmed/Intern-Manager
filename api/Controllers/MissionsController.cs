using System.Text.Json;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/missions")]
[Authorize(Roles = "Supervisor")]
public sealed class MissionsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMyMissions(
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

        var missionsQuery = dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == currentSupervisorId.Value)
            .Include(mission => mission.Intern);

        var total = await missionsQuery.CountAsync(cancellationToken);

        var missions = await missionsQuery
            .OrderByDescending(mission => mission.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var missionIds = missions.Select(mission => mission.Id).ToList();
        var deliverableCountsByMissionId = missionIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await dbContext.Deliverables
                .AsNoTracking()
                .Where(deliverable => missionIds.Contains(deliverable.MissionId))
                .GroupBy(deliverable => deliverable.MissionId)
                .Select(group => new { missionId = group.Key, count = group.Count() })
                .ToDictionaryAsync(item => item.missionId, item => item.count, cancellationToken);

        var data = missions.Select(mission =>
        {
            var deliverablesCount = deliverableCountsByMissionId.TryGetValue(mission.Id, out var count)
                ? count
                : 0;

            return new
            {
                id = mission.Id,
                title = mission.Title,
                internName = mission.Intern != null
                    ? $"{mission.Intern.FirstName} {mission.Intern.LastName}".Trim()
                    : (string?)null,
                status = mission.Status,
                deliverableCount = deliverablesCount,
                deliverablesCount
            };
        });

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    [HttpPost]
    public async Task<IActionResult> CreateMission([FromBody] CreateMissionRequest request, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        if (!TryResolveOptionalInternId(request.InternId, out var internId))
        {
            return BadRequest(new { message = "Invalid internId." });
        }

        if (internId.HasValue)
        {
            var internExists = await dbContext.Users
                .AsNoTracking()
                .AnyAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

            if (!internExists)
            {
                return BadRequest(new { message = "Intern not found." });
            }

            var canAssignIntern = await CanAssignInternAsync(supervisorId.Value, internId.Value, cancellationToken);
            if (!canAssignIntern)
            {
                return Forbid();
            }
        }

        var skillValues = (request.Skills ?? Array.Empty<string>())
            .Where(skill => !string.IsNullOrWhiteSpace(skill))
            .Select(skill => skill.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var mission = new Mission
        {
            Id = Guid.NewGuid(),
            SupervisorId = supervisorId.Value,
            InternId = internId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            SkillsJson = JsonSerializer.Serialize(skillValues),
            Tools = request.Tools?.Trim() ?? string.Empty,
            Level = request.Level?.Trim() ?? string.Empty,
            Status = "active",
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Missions.Add(mission);

        var deliverableTitles = (request.Deliverables ?? Array.Empty<string>())
            .Where(title => !string.IsNullOrWhiteSpace(title))
            .Select(title => title.Trim())
            .ToList();

        for (var index = 0; index < deliverableTitles.Count; index++)
        {
            var deliverable = new Deliverable
            {
                Id = Guid.NewGuid(),
                MissionId = mission.Id,
                SupervisorId = supervisorId.Value,
                InternId = internId,
                Title = deliverableTitles[index],
                Status = "pending",
                FileUrl = string.Empty,
                Version = 1,
                Progress = 0,
                DueDate = DateTime.UtcNow.AddDays(7 * (index + 1)),
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Deliverables.Add(deliverable);

            if (internId.HasValue)
            {
                dbContext.InternTasks.Add(new InternTask
                {
                    Id = Guid.NewGuid(),
                    InternId = internId.Value,
                    DeliverableId = deliverable.Id,
                    Title = deliverable.Title,
                    DueDate = deliverable.DueDate,
                    IsComplete = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "mission.create",
            Entity = $"mission:{mission.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new
        {
            id = mission.Id,
            title = mission.Title,
            status = mission.Status
        });
    }

    private async Task<bool> CanAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken)
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

    private static bool TryResolveOptionalInternId(string? rawInternId, out Guid? internId)
    {
        internId = null;

        if (string.IsNullOrWhiteSpace(rawInternId))
        {
            return true;
        }

        if (Guid.TryParse(rawInternId.Trim(), out var parsedInternId))
        {
            internId = parsedInternId;
            return true;
        }

        return false;
    }

}

public sealed class CreateMissionRequest
{
    public string Title { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;

    public string[] Skills { get; init; } = Array.Empty<string>();

    public string Tools { get; init; } = string.Empty;

    public string Level { get; init; } = string.Empty;

    public string[] Deliverables { get; init; } = Array.Empty<string>();

    public string InternId { get; init; } = string.Empty;
}
