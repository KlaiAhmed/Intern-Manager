using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de récupération des informations de stage du stagiaire.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/intern/me")]
[Authorize(Roles = "Intern")]
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
            .Where(item => item.InternId == internId.Value)
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

        var lifecycleStatus = profile?.Status ?? InternLifecycleStatus.INCOMPLETE;
        var startDate = profile?.StartDate;
        var endDate = profile?.EndDate;

        var supervisorName = mission?.Supervisor is null
            ? string.Empty
            : $"{mission.Supervisor.FirstName} {mission.Supervisor.LastName}".Trim();

        return Ok(new
        {
            id = mission?.Id ?? intern.Id,
            missionTitle = mission?.Title ?? string.Empty,
            supervisorName,
            department = intern.Department?.Name ?? string.Empty,
            startDate,
            endDate,
            status = lifecycleStatus.ToString(),
            progress
        });
    }

}
