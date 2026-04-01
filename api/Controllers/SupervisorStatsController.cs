/// <summary>
/// 📁 Emplacement : api/Controllers/SupervisorStatsController.cs
/// 🎯 Rôle : Expose les statistiques personnelles du superviseur connecté.
/// 📦 Contient : [SupervisorStatsController]
/// </summary>
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de statistiques pour le superviseur connecté.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/stats/supervisor/me")]
[Authorize(Roles = "Supervisor")]
public sealed class SupervisorStatsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Récupère le nombre de stagiaires actifs du superviseur.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires actifs assignés au superviseur connecté.
    /// Un stagiaire est assigné s il a une mission, un livrable, une évaluation
    /// ou une réunion avec ce superviseur.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stagiaires actifs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("interns/active", Name = "GetMyActiveInterns")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorActiveInternsCount(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var supervisorInternIds = await ResolveSupervisorInternIdsAsync(supervisorId.Value, cancellationToken);
        if (supervisorInternIds.Count == 0)
        {
            return Ok(new { count = 0 });
        }

        var count = await dbContext.Users
            .AsNoTracking()
            .CountAsync(user => supervisorInternIds.Contains(user.Id) &&
                                user.Role == UserRole.Intern &&
                                user.Status == UserStatus.Active,
                        cancellationToken);

        return Ok(new { count });
    }

    /// <summary>
    /// Récupère le nombre de livrables en attente du superviseur.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de livrables avec le statut "pending"
    /// ou "submitted" qui sont assignés au superviseur connecté.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de livrables en attente.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("deliverables/pending", Name = "GetMyPendingDeliverables")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorPendingDeliverablesCount(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var count = await dbContext.Deliverables
            .AsNoTracking()
            .CountAsync(deliverable => deliverable.SupervisorId == supervisorId.Value &&
                                        (deliverable.Status == "pending" || deliverable.Status == "submitted"),
                        cancellationToken);

        return Ok(new { count });
    }

    /// <summary>
    /// Récupère la progression moyenne des livrables du superviseur.
    /// </summary>
    /// <remarks>
    /// Cette route retourne la progression moyenne de tous les livrables
    /// assignés au superviseur connecté. La valeur est comprise entre 0 et 100.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>La progression moyenne (entre 0 et 100).</returns>
    /// <response code="200">Valeur récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("avg-progress", Name = "GetMyAvgProgress")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorAverageProgress(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var deliverableProgressValues = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId.Value)
            .Select(deliverable => deliverable.Progress)
            .ToListAsync(cancellationToken);

        var averageProgress = deliverableProgressValues.Count == 0
            ? 0
            : deliverableProgressValues.Average(progress => Math.Clamp(progress, 0, 100));

        return Ok(new { value = Math.Round(averageProgress, 2) });
    }

    /// <summary>
    /// Récupère le nombre de stagiaires en retard.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires qui ont au moins un livrable
    /// en retard (date d échéance dépassée et non traité) assigné au superviseur connecté.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stagiaires en retard.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("overdue", Name = "GetMyOverdueItems")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorOverdueCount(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var utcNow = DateTime.UtcNow;
        var count = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId.Value &&
                                  deliverable.DueDate.HasValue &&
                                  deliverable.DueDate.Value < utcNow &&
                                  deliverable.Status != "accepted" &&
                                  deliverable.Status != "rejected")
            .Select(deliverable => deliverable.InternId)
            .Where(internId => internId.HasValue)
            .Select(internId => internId!.Value)
            .Distinct()
            .CountAsync(cancellationToken);

        return Ok(new { count });
    }

    private async Task<HashSet<Guid>> ResolveSupervisorInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var internIds = new HashSet<Guid>();

        internIds.UnionWith(await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == supervisorId && mission.InternId.HasValue)
            .Select(mission => mission.InternId!.Value)
            .ToListAsync(cancellationToken));

        internIds.UnionWith(await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId && deliverable.InternId.HasValue)
            .Select(deliverable => deliverable.InternId!.Value)
            .ToListAsync(cancellationToken));

        internIds.UnionWith(await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == supervisorId)
            .Select(evaluation => evaluation.InternId)
            .ToListAsync(cancellationToken));

        internIds.UnionWith(await dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.SupervisorId == supervisorId)
            .Select(meeting => meeting.InternId)
            .ToListAsync(cancellationToken));

        return internIds;
    }
}
