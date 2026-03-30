using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/intern/me/evaluations")]
[Authorize(Roles = "Intern")]
public sealed class InternEvaluationsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMyEvaluations(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var data = await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.InternId == internId.Value && evaluation.Status == "submitted")
            .Include(evaluation => evaluation.Supervisor)
            .OrderByDescending(evaluation => evaluation.SubmittedAt)
            .ThenByDescending(evaluation => evaluation.CreatedAt)
            .Select(evaluation => new
            {
                id = evaluation.Id,
                type = NormalizeTypeForIntern(evaluation.Type),
                criteria = new
                {
                    technical = evaluation.Technical,
                    autonomy = evaluation.Autonomy,
                    communication = evaluation.Communication,
                    deadlineRespect = evaluation.DeadlineRespect,
                    deliverableQuality = evaluation.DeliverableQuality
                },
                comments = evaluation.Comments,
                supervisorName = evaluation.Supervisor != null
                    ? $"{evaluation.Supervisor.FirstName} {evaluation.Supervisor.LastName}".Trim()
                    : string.Empty
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data });
    }

    private static string NormalizeTypeForIntern(string rawType)
    {
        var normalizedType = rawType.Trim().ToLowerInvariant();

        return normalizedType switch
        {
            "mid-term" => "mid_term",
            "end" => "end_of_internship",
            _ => normalizedType
        };
    }

}
