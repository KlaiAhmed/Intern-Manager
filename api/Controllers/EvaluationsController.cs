using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/evaluations")]
[Authorize(Roles = "Supervisor")]
public sealed class EvaluationsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingEvaluations(
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

        var assignedInternIds = await ResolveAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return Ok(new { data = Array.Empty<object>(), total = 0, page = safePage, limit = safeLimit });
        }

        var query = dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == currentSupervisorId.Value &&
                                 evaluation.Status == "pending" &&
                                 assignedInternIds.Contains(evaluation.InternId));

        var total = await query.CountAsync(cancellationToken);

        var pendingData = await query
            .Include(evaluation => evaluation.Intern)
            .OrderBy(evaluation => evaluation.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(evaluation => new
            {
                id = evaluation.Id,
                internId = evaluation.InternId,
                internName = evaluation.Intern != null
                    ? $"{evaluation.Intern.FirstName} {evaluation.Intern.LastName}".Trim()
                    : string.Empty,
                type = evaluation.Type
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data = pendingData, total, page = safePage, limit = safeLimit });
    }

    [HttpPost("pending/sync")]
    public async Task<IActionResult> SyncPendingEvaluations(CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var assignedInternIds = await ResolveAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return Ok(new { created = 0 });
        }

        var existingEvaluations = await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == currentSupervisorId.Value &&
                                 assignedInternIds.Contains(evaluation.InternId))
            .Select(evaluation => new
            {
                evaluation.InternId,
                normalizedType = NormalizeEvaluationType(evaluation.Type)
            })
            .ToListAsync(cancellationToken);

        var existingKeys = existingEvaluations
            .Where(item => item.normalizedType is not null)
            .Select(item => $"{item.InternId:N}:{item.normalizedType}")
            .ToHashSet(StringComparer.Ordinal);

        var requiredTypes = new[] { "mid-term", "end" };
        var createdCount = 0;

        foreach (var internId in assignedInternIds)
        {
            foreach (var requiredType in requiredTypes)
            {
                var key = $"{internId:N}:{requiredType}";
                if (existingKeys.Contains(key))
                {
                    continue;
                }

                dbContext.Evaluations.Add(new Evaluation
                {
                    Id = Guid.NewGuid(),
                    SupervisorId = currentSupervisorId.Value,
                    InternId = internId,
                    Type = requiredType,
                    Status = "pending",
                    CreatedAt = DateTime.UtcNow
                });

                existingKeys.Add(key);
                createdCount++;
            }
        }

        if (createdCount > 0)
        {
            dbContext.AuditLogs.Add(new AuditLog
            {
                ActorUserId = currentSupervisorId,
                Actor = UserContextHelper.ResolveCurrentActorName(User),
                Action = "evaluation.pending.sync",
                Entity = $"count:{createdCount}",
                Timestamp = DateTime.UtcNow
            });

            await dbContext.SaveChangesAsync(cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new { created = createdCount });
        }

        return Ok(new { created = 0 });
    }

    [HttpPost]
    public async Task<IActionResult> SubmitEvaluation([FromBody] SubmitEvaluationRequest request, CancellationToken cancellationToken)
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

        var normalizedType = NormalizeEvaluationType(request.Type);
        if (normalizedType is null)
        {
            return BadRequest(new { message = "type must be 'mid-term' or 'end'." });
        }

        var criteria = request.Criteria ?? request.Scores;
        if (criteria is null)
        {
            return BadRequest(new { message = "criteria is required." });
        }

        var assignedInternIds = await ResolveAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (!assignedInternIds.Contains(request.InternId))
        {
            return Forbid();
        }

        var internExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == request.InternId && user.Role == UserRole.Intern, cancellationToken);

        if (!internExists)
        {
            return BadRequest(new { message = "Intern not found." });
        }

        var evaluation = await dbContext.Evaluations
            .FirstOrDefaultAsync(item => item.SupervisorId == currentSupervisorId.Value &&
                                         item.InternId == request.InternId &&
                                         item.Type == normalizedType,
                                 cancellationToken);

        var isCreated = false;

        if (evaluation is null)
        {
            isCreated = true;
            evaluation = new Evaluation
            {
                Id = Guid.NewGuid(),
                SupervisorId = currentSupervisorId.Value,
                InternId = request.InternId,
                Type = normalizedType,
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Evaluations.Add(evaluation);
        }

        evaluation.Technical = ClampScore(criteria.Technical);
        evaluation.Autonomy = ClampScore(criteria.Autonomy);
        evaluation.Communication = ClampScore(criteria.Communication);
        evaluation.DeadlineRespect = ClampScore(criteria.DeadlineRespect);
        evaluation.DeliverableQuality = ClampScore(criteria.DeliverableQuality);
        evaluation.Comments = request.Comments?.Trim() ?? string.Empty;
        evaluation.Status = "submitted";
        evaluation.SubmittedAt = DateTime.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentSupervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "evaluation.submit",
            Entity = $"evaluation:{evaluation.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var response = new
        {
            id = evaluation.Id,
            internId = evaluation.InternId,
            type = evaluation.Type
        };

        return isCreated
            ? StatusCode(StatusCodes.Status201Created, response)
            : Ok(response);
    }

    private async Task<HashSet<Guid>> ResolveAssignedInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var assignedInternIds = new HashSet<Guid>();

        assignedInternIds.UnionWith(await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == supervisorId && mission.InternId.HasValue)
            .Select(mission => mission.InternId!.Value)
            .ToListAsync(cancellationToken));

        assignedInternIds.UnionWith(await dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.SupervisorId == supervisorId)
            .Select(meeting => meeting.InternId)
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

        return assignedInternIds;
    }

    private static int ClampScore(int value)
    {
        return Math.Clamp(value, 0, 10);
    }

    private static string? NormalizeEvaluationType(string? rawType)
    {
        if (string.IsNullOrWhiteSpace(rawType))
        {
            return null;
        }

        var normalized = rawType
            .Trim()
            .ToLowerInvariant()
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal);

        return normalized switch
        {
            "midterm" => "mid-term",
            "end" => "end",
            "endofinternship" => "end",
            _ => null
        };
    }

}

public sealed class SubmitEvaluationRequest
{
    public Guid InternId { get; init; }

    public string Type { get; init; } = string.Empty;

    public EvaluationCriteriaRequest? Criteria { get; init; }

    public EvaluationCriteriaRequest? Scores { get; init; }

    public string Comments { get; init; } = string.Empty;
}

public sealed class EvaluationCriteriaRequest
{
    public int Technical { get; init; }

    public int Autonomy { get; init; }

    public int Communication { get; init; }

    public int DeadlineRespect { get; init; }

    public int DeliverableQuality { get; init; }
}
