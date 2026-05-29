using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Attributes;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de récupération des informations de stage du stagiaire.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/intern/me")]
// RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
[Authorize(Roles = "SuperAdmin,Admin,Intern")]
public sealed class InternshipController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Récupère les informations de stage du stagiaire connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne un récapitulatif du stage du stagiaire : titre de la mission,
    /// nom du superviseur, département, dates de début et de fin, statut et progression globale.
    /// La progression est calculée à partir des livrables.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de stage.</returns>
    /// <response code="200">Informations récupérées avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Stagiaire non trouvé.</response>
    [HttpGet("internship", Name = "GetMyInternship")]
    [FeatureCard(DashboardCard.MissionOverview)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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
            .Include(item => item.CoSupervisor)
            .Where(item => item.InternId == internId.Value ||
                           item.InternAssignments.Any(assignment => assignment.InternId == internId.Value))
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var profile = await dbContext.InternProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.InternId == internId.Value, cancellationToken);

        var missionDeliverables = mission is null
            ? []
            : await dbContext.Deliverables
                .AsNoTracking()
                .Where(item => item.MissionId == mission.Id)
                .ToListAsync(cancellationToken);

        var progress = missionDeliverables.Count == 0
            ? 0
            : (int)Math.Round(missionDeliverables.Average(item => Math.Clamp(item.Progress, 0, 100)));

        var startDate = profile?.StartDate;
        var endDate = profile?.EndDate;

        var supervisorName = mission?.Supervisor is null
            ? string.Empty
            : $"{mission.Supervisor.FirstName} {mission.Supervisor.LastName}".Trim();

        var coSupervisorName = mission?.CoSupervisor is null
            ? null
            : BuildUserName(mission.CoSupervisor);

        return Ok(new
        {
            id = mission?.Id ?? intern.Id,
            missionTitle = mission?.Title ?? string.Empty,
            supervisorName,
            coSupervisorName,
            department = intern.Department?.Name ?? string.Empty,
            startDate,
            endDate,
            status = intern.VerificationStatus.ToString(),
            verificationStatus = intern.VerificationStatus.ToString(),
            progress
        });
    }

    /// <summary>
    /// Récupère l historique des missions du stagiaire connecté.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Liste des missions affectées au stagiaire.</returns>
    [HttpGet("missions", Name = "GetMyMissions")]
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(InternMissionHistoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyMissions(CancellationToken cancellationToken)
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

        var missions = await dbContext.Missions
            .AsNoTracking()
            .Include(mission => mission.Supervisor)
            .Include(mission => mission.CoSupervisor)
            .Include(mission => mission.InternshipType)
            .Include(mission => mission.InternAssignments)
            .Where(mission => mission.InternId == internId.Value ||
                              mission.InternAssignments.Any(assignment => assignment.InternId == internId.Value))
            .OrderByDescending(mission => mission.StartDate ?? mission.CreatedAt)
            .ThenByDescending(mission => mission.CreatedAt)
            .ToListAsync(cancellationToken);

        if (missions.Count == 0)
        {
            return Ok(new InternMissionHistoryResponse());
        }

        var missionIds = missions.Select(mission => mission.Id).ToList();
        var deliverableProgressRows = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => missionIds.Contains(deliverable.MissionId))
            .Select(deliverable => new
            {
                deliverable.MissionId,
                deliverable.Progress
            })
            .ToListAsync(cancellationToken);

        var progressByMissionId = deliverableProgressRows
            .GroupBy(item => item.MissionId)
            .ToDictionary(
                group => group.Key,
                group => (int)Math.Round(group.Average(item => Math.Clamp(item.Progress, 0, 100))));

        var response = new InternMissionHistoryResponse
        {
            Missions = missions
                .Select(mission =>
                {
                    progressByMissionId.TryGetValue(mission.Id, out var progress);

                    var assignedAt = mission.InternAssignments
                        .Where(assignment => assignment.InternId == internId.Value)
                        .OrderByDescending(assignment => assignment.AssignedAt)
                        .Select(assignment => (DateTime?)assignment.AssignedAt)
                        .FirstOrDefault();

                    return new InternMissionHistoryItemResponse
                    {
                        Id = mission.Id,
                        MissionTitle = mission.Title,
                        Status = mission.Status,
                        StartDate = mission.StartDate ?? mission.CreatedAt,
                        EndDate = mission.EndDate,
                        Progress = progress,
                        SupervisorName = mission.Supervisor is null ? string.Empty : BuildUserName(mission.Supervisor),
                        CoSupervisorName = mission.CoSupervisor is null ? null : BuildUserName(mission.CoSupervisor),
                        DepartmentName = intern.Department?.Name,
                        Type = mission.InternshipType?.Name ?? (string.IsNullOrWhiteSpace(mission.Level) ? null : mission.Level),
                        AssignedAt = assignedAt
                    };
                })
                .ToList()
        };

        return Ok(response);
    }

    private static string BuildUserName(User user)
    {
        return $"{user.FirstName} {user.LastName}".Trim();
    }

}
