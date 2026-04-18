using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de consultation des stagiaires d un superviseur.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="supervisorInternsService">Service métier des vues de suivi des stagiaires superviseur.</param>
[ApiController]
[Route("api/supervisor/me")]
// RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
[Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
public sealed class SupervisorInternsController(
    AppDbContext dbContext,
    ISupervisorInternsService supervisorInternsService) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des stagiaires du superviseur connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne tous les stagiaires assignés au superviseur connecté.
    /// Un stagiaire est considéré comme assigné s il a une mission, un livrable,
    /// une évaluation ou une réunion avec ce superviseur.
    /// Les résultats incluent le titre de la mission, la progression moyenne,
    /// la date du dernier journal et un indicateur de retard.
    /// </remarks>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée de stagiaires.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("interns", Name = "ListMyInterns")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyInterns(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");

        var supervisor = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                user => user.Id == supervisorId.Value && user.Role == UserRole.Supervisor,
                cancellationToken);

        if (supervisor is null && !isAdminScope)
        {
            return Forbid();
        }

        var assignedInternIdsQuery = (
                from assignment in dbContext.MissionInternAssignments.AsNoTracking()
                join mission in dbContext.Missions.AsNoTracking() on assignment.MissionId equals mission.Id
                where mission.SupervisorId == supervisorId.Value
                select assignment.InternId)
            .Union(
                dbContext.Missions
                    .AsNoTracking()
                    .Where(mission => mission.SupervisorId == supervisorId.Value && mission.InternId.HasValue)
                    .Select(mission => mission.InternId!.Value))
            .Union(
                dbContext.Deliverables
                    .AsNoTracking()
                    .Where(deliverable => deliverable.SupervisorId == supervisorId.Value && deliverable.InternId.HasValue)
                    .Select(deliverable => deliverable.InternId!.Value))
            .Union(
                dbContext.Evaluations
                    .AsNoTracking()
                    .Where(evaluation => evaluation.SupervisorId == supervisorId.Value)
                    .Select(evaluation => evaluation.InternId))
            .Union(
                dbContext.Meetings
                    .AsNoTracking()
                    .Where(meeting => meeting.SupervisorId == supervisorId.Value)
                    .Select(meeting => meeting.InternId));

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var internUsersQuery = dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Intern && assignedInternIdsQuery.Contains(user.Id))
            .OrderBy(user => user.FirstName)
            .ThenBy(user => user.LastName);

        var total = await internUsersQuery.CountAsync(cancellationToken);

        if (total == 0)
        {
            return Ok(new { data = Array.Empty<object>() });
        }

        var utcNow = DateTime.UtcNow;

        var data = await internUsersQuery
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(user => new
            {
                id = user.Id,
                name = $"{user.FirstName} {user.LastName}".Trim(),
                missionTitle = dbContext.Missions
                    .Where(mission => mission.SupervisorId == supervisorId.Value &&
                                      (mission.InternId == user.Id || mission.InternAssignments.Any(assignment => assignment.InternId == user.Id)))
                    .OrderByDescending(mission => mission.CreatedAt)
                    .Select(mission => mission.Title)
                    .FirstOrDefault() ?? string.Empty,
                progress = (int)Math.Round(
                    dbContext.Deliverables
                        .Where(deliverable => deliverable.SupervisorId == supervisorId.Value && deliverable.InternId == user.Id)
                        .Select(deliverable => (double?)(deliverable.Progress < 0
                            ? 0
                            : deliverable.Progress > 100
                                ? 100
                                : deliverable.Progress))
                        .Average() ?? 0d),
                lastJournalDate = dbContext.JournalEntries
                    .Where(entry => entry.InternId == user.Id)
                    .Select(entry => (DateTime?)entry.CreatedAt)
                    .Max(),
                isOverdue = dbContext.Deliverables
                    .Any(deliverable => deliverable.SupervisorId == supervisorId.Value &&
                                        deliverable.InternId == user.Id &&
                                        deliverable.DueDate.HasValue &&
                                        deliverable.DueDate.Value < utcNow &&
                                        deliverable.Status != "accepted" &&
                                        deliverable.Status != "rejected")
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Récupère la progression synthétique des stagiaires du superviseur connecté.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste avec mission, type de stage, progression et statut de risque.</returns>
    [HttpGet("interns/progress", Name = "ListMyInternsProgress")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyInternsProgress(CancellationToken cancellationToken = default)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var data = await supervisorInternsService.GetInternProgressAsync(supervisorId.Value, cancellationToken);
        return Ok(new { data, total = data.Count });
    }

}
