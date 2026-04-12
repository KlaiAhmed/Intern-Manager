using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de statistiques pour le superviseur connecté.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="supervisorScopeService">Service de résolution du périmètre des stagiaires d un superviseur.</param>
/// <param name="supervisorStatsService">Service métier des statistiques superviseur.</param>
[ApiController]
[Route("api/stats/supervisor/me")]
// RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
[Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
public sealed class SupervisorStatsController(
    AppDbContext dbContext,
    ISupervisorScopeService supervisorScopeService,
    ISupervisorStatsService supervisorStatsService) : ControllerBase
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
    [EnableRateLimiting("read-frequent")]
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

        var supervisorInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(supervisorId.Value, cancellationToken);
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
    [EnableRateLimiting("read-frequent")]
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
    [EnableRateLimiting("read-frequent")]
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

        var averageProgress = await supervisorStatsService.GetAverageProgressAsync(supervisorId.Value, cancellationToken);

        return Ok(new { value = averageProgress });
    }

    /// <summary>
    /// Récupère le délai moyen de validation des livrables sur le mois courant.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le délai moyen en jours ainsi que la taille de l échantillon.</returns>
    [HttpGet("avg-validation-delay", Name = "GetMyAvgValidationDelay")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(AvgValidationDelayResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorAverageValidationDelay(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var response = await supervisorStatsService.GetAverageValidationDelayAsync(supervisorId.Value, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Récupère la charge de supervision du superviseur connecté.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Charge actuelle, capacité et répartition par type de stage.</returns>
    [HttpGet("workload", Name = "GetMyWorkload")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(SupervisorWorkloadResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorWorkload(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var response = await supervisorStatsService.GetWorkloadAsync(supervisorId.Value, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Récupère les alertes de retard des livrables du superviseur.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>La liste des livrables en retard ordonnée par criticité.</returns>
    [HttpGet("delays-alerts", Name = "GetMyDelaysAlerts")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(DelaysAlertsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorDelaysAlerts(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var response = await supervisorStatsService.GetDelaysAlertsAsync(supervisorId.Value, cancellationToken);
        return Ok(response);
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
    [EnableRateLimiting("read-frequent")]
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

}
