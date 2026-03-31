/// <summary>
/// 📁 Emplacement : api/Controllers/SupervisorInternsController.cs
/// 🎯 Rôle : Expose les stagiaires assignés au superviseur connecté.
/// 📦 Contient : [SupervisorInternsController]
/// </summary>
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de consultation des stagiaires d un superviseur.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/supervisor/me")]
[Authorize(Roles = "Supervisor")]
public sealed class SupervisorInternsController(AppDbContext dbContext) : ControllerBase
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

        var supervisor = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                user => user.Id == supervisorId.Value && user.Role == UserRole.Supervisor,
                cancellationToken);

        if (supervisor is null)
        {
            return Forbid();
        }

        var assignedInternIds = new HashSet<Guid>();

        assignedInternIds.UnionWith(await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == supervisorId.Value && mission.InternId.HasValue)
            .Select(mission => mission.InternId!.Value)
            .ToListAsync(cancellationToken));

        assignedInternIds.UnionWith(await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId.Value && deliverable.InternId.HasValue)
            .Select(deliverable => deliverable.InternId!.Value)
            .ToListAsync(cancellationToken));

        assignedInternIds.UnionWith(await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == supervisorId.Value)
            .Select(evaluation => evaluation.InternId)
            .ToListAsync(cancellationToken));

        assignedInternIds.UnionWith(await dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.SupervisorId == supervisorId.Value)
            .Select(meeting => meeting.InternId)
            .ToListAsync(cancellationToken));

        if (assignedInternIds.Count == 0)
        {
            return Ok(new { data = Array.Empty<object>() });
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var internUsersQuery = dbContext.Users
            .AsNoTracking()
            .Where(user => assignedInternIds.Contains(user.Id) && user.Role == UserRole.Intern)
            .OrderBy(user => user.FirstName)
            .ThenBy(user => user.LastName);

        var total = await internUsersQuery.CountAsync(cancellationToken);

        var internUsers = await internUsersQuery
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        if (internUsers.Count == 0)
        {
            return Ok(new { data = Array.Empty<object>() });
        }

        var internIds = internUsers.Select(user => user.Id).ToList();

        var missions = await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == supervisorId.Value &&
                              mission.InternId.HasValue &&
                              internIds.Contains(mission.InternId.Value))
            .OrderByDescending(mission => mission.CreatedAt)
            .ToListAsync(cancellationToken);

        var latestMissionTitleByInternId = missions
            .GroupBy(mission => mission.InternId!.Value)
            .ToDictionary(group => group.Key, group => group.First().Title);

        var deliverables = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId.Value &&
                                  deliverable.InternId.HasValue &&
                                  internIds.Contains(deliverable.InternId.Value))
            .ToListAsync(cancellationToken);

        var averageProgressByInternId = deliverables
            .GroupBy(deliverable => deliverable.InternId!.Value)
            .ToDictionary(
                group => group.Key,
                group => (int)Math.Round(group.Average(deliverable => Math.Clamp(deliverable.Progress, 0, 100))));

        var utcNow = DateTime.UtcNow;
        var overdueByInternId = deliverables
            .Where(deliverable => deliverable.DueDate.HasValue &&
                                  deliverable.DueDate.Value < utcNow &&
                                  !IsClosedDeliverableStatus(deliverable.Status))
            .GroupBy(deliverable => deliverable.InternId!.Value)
            .ToDictionary(group => group.Key, _ => true);

        var journalEntries = await dbContext.JournalEntries
            .AsNoTracking()
            .Where(entry => internIds.Contains(entry.InternId))
            .ToListAsync(cancellationToken);

        var lastJournalDateByInternId = journalEntries
            .GroupBy(entry => entry.InternId)
            .ToDictionary(group => group.Key, group => group.Max(entry => entry.CreatedAt));

        var data = internUsers.Select(user => new
        {
            id = user.Id,
            name = $"{user.FirstName} {user.LastName}".Trim(),
            missionTitle = latestMissionTitleByInternId.TryGetValue(user.Id, out var missionTitle)
                ? missionTitle
                : string.Empty,
            progress = averageProgressByInternId.TryGetValue(user.Id, out var progress)
                ? progress
                : 0,
            lastJournalDate = lastJournalDateByInternId.TryGetValue(user.Id, out var lastJournalDate)
                ? lastJournalDate
                : (DateTime?)null,
            isOverdue = overdueByInternId.ContainsKey(user.Id)
        });

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    private static bool IsClosedDeliverableStatus(string status)
    {
        var normalizedStatus = status.Trim().ToLowerInvariant();
        return normalizedStatus is "accepted" or "rejected";
    }

}
