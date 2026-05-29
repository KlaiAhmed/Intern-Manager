using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de consultation des logs d audit.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "SuperAdmin,Admin,Manager")]
public sealed class AuditLogsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des événements d audit.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les logs d audit du système. Vous pouvez filtrer
    /// par auteur ou par type d action. Les résultats sont triés par date,
    /// du plus récent au plus ancien. Seuls les administrateurs peuvent y accéder.
    /// </remarks>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="actor">Filtre par auteur de l action.</param>
    /// <param name="action">Filtre par type d action.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée d événements d audit.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="400">Paramètres invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListAuditLogs")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? actor = null,
        [FromQuery] string? action = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.AuditLogs
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(actor))
        {
            var normalizedActor = actor.Trim();
            query = query.Where(log => EF.Functions.Like(log.Actor, $"%{normalizedActor}%"));
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            var normalizedAction = action.Trim();
            query = query.Where(log => EF.Functions.Like(log.Action, $"%{normalizedAction}%"));
        }

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderByDescending(log => log.Timestamp)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(log => new
            {
                id = log.Id,
                actor = log.Actor,
                action = log.Action,
                entity = log.Entity,
                timestamp = log.Timestamp
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }
}
