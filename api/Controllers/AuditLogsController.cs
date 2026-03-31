/// <summary>
/// 📁 Emplacement : api/Controllers/AuditLogsController.cs
/// 🎯 Rôle : Expose les logs d audit consommés par les dashboards administratifs.
/// 📦 Contient : [AuditLogsController]
/// </summary>
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de consultation des logs d audit.
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "SuperAdmin,Admin")]
public sealed class AuditLogsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Retourne la liste des événements d audit récents.
    /// </summary>
    [HttpGet(Name = "ListAuditLogs")]
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
