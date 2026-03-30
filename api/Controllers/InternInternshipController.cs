using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/intern/me/internship")]
[Authorize(Roles = "Intern")]
public sealed class InternInternshipController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMyInternship(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var intern = await dbContext.Users
            .AsNoTracking()
            .Include(user => user.Department)
            .FirstOrDefaultAsync(
                user => user.Id == internId.Value && user.Role == UserRole.Intern,
                cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var mission = await dbContext.Missions
            .AsNoTracking()
            .Include(item => item.Supervisor)
            .Where(item => item.InternId == internId.Value)
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var missionDeliverables = mission is null
            ? []
            : await dbContext.Deliverables
                .AsNoTracking()
                .Where(item => item.MissionId == mission.Id)
                .ToListAsync(cancellationToken);

        var progress = missionDeliverables.Count == 0
            ? 0
            : (int)Math.Round(missionDeliverables.Average(item => Math.Clamp(item.Progress, 0, 100)));

        var startDate = mission?.CreatedAt ?? intern.CreatedAt;
        var endDate = missionDeliverables
            .Where(item => item.DueDate.HasValue)
            .Select(item => item.DueDate!.Value)
            .OrderByDescending(date => date)
            .FirstOrDefault();

        if (endDate == default)
        {
            endDate = startDate.AddDays(90);
        }

        var supervisorName = mission?.Supervisor is null
            ? string.Empty
            : $"{mission.Supervisor.FirstName} {mission.Supervisor.LastName}".Trim();

        var status = !string.IsNullOrWhiteSpace(mission?.Status)
            ? mission.Status
            : intern.Status.ToString().ToLowerInvariant();

        return Ok(new
        {
            id = mission?.Id ?? intern.Id,
            missionTitle = mission?.Title ?? string.Empty,
            supervisorName,
            department = intern.Department?.Name ?? string.Empty,
            startDate,
            endDate,
            status,
            progress
        });
    }

}
