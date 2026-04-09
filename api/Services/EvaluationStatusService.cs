using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class EvaluationStatusService(
    AppDbContext dbContext,
    ISupervisorScopeService supervisorScopeService) : IEvaluationStatusService
{
    public async Task<EvaluationStatusResponse> GetSupervisorEvaluationStatusAsync(
        Guid supervisorId,
        CancellationToken cancellationToken)
    {
        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(supervisorId, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return new EvaluationStatusResponse();
        }

        var evaluations = await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == supervisorId && assignedInternIds.Contains(evaluation.InternId))
            .Select(evaluation => new
            {
                evaluation.Id,
                evaluation.InternId,
                InternFirstName = evaluation.Intern != null ? evaluation.Intern.FirstName : string.Empty,
                InternLastName = evaluation.Intern != null ? evaluation.Intern.LastName : string.Empty,
                evaluation.Type,
                evaluation.Status,
                evaluation.Technical,
                evaluation.Autonomy,
                evaluation.Communication,
                evaluation.DeadlineRespect,
                evaluation.DeliverableQuality,
                evaluation.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var due = evaluations
            .Where(evaluation => string.Equals(
                evaluation.Status,
                DomainStatuses.Evaluation.Pending,
                StringComparison.OrdinalIgnoreCase))
            .OrderBy(evaluation => evaluation.CreatedAt)
            .Select(evaluation => new EvaluationDueItem
            {
                EvaluationId = evaluation.Id,
                InternId = evaluation.InternId,
                InternName = $"{evaluation.InternFirstName} {evaluation.InternLastName}".Trim(),
                Type = NormalizeEvaluationType(evaluation.Type)
            })
            .ToList();

        var completed = evaluations
            .Where(evaluation => string.Equals(
                evaluation.Status,
                DomainStatuses.Evaluation.Submitted,
                StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(evaluation => evaluation.CreatedAt)
            .Select(evaluation => new EvaluationCompletedItem
            {
                EvaluationId = evaluation.Id,
                InternId = evaluation.InternId,
                InternName = $"{evaluation.InternFirstName} {evaluation.InternLastName}".Trim(),
                Type = NormalizeEvaluationType(evaluation.Type),
                AverageScore = Math.Round(
                    (evaluation.Technical +
                     evaluation.Autonomy +
                     evaluation.Communication +
                     evaluation.DeadlineRespect +
                     evaluation.DeliverableQuality) / 5d,
                    1),
                SubmittedAt = evaluation.CreatedAt
            })
            .ToList();

        return new EvaluationStatusResponse
        {
            Due = due,
            Completed = completed
        };
    }

    private static string NormalizeEvaluationType(string rawType)
    {
        if (string.IsNullOrWhiteSpace(rawType))
        {
            return string.Empty;
        }

        var normalizedType = rawType
            .Trim()
            .ToLowerInvariant()
            .Replace("_", "-", StringComparison.Ordinal)
            .Replace(" ", "-", StringComparison.Ordinal);

        return normalizedType switch
        {
            "midterm" => "mid-term",
            "mid-term" => "mid-term",
            "mid-parcours" => "mid-term",
            "mid-stage" => "mid-term",
            "end" => "end",
            "end-of-stage" => "end",
            "endstage" => "end",
            "end-of-internship" => "end",
            "endofinternship" => "end",
            _ => normalizedType
        };
    }
}
