/// <summary>
/// 📁 Emplacement : api/Controllers/AuditLogsController.cs
/// 🎯 Rôle : Expose les logs d audit consommés par les dashboards administratifs.
/// 📦 Contient : [AuditLogsController]
/// </summary>
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de consultation des logs d audit.
/// </summary>
[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = "SuperAdmin,Admin")]
public sealed class AuditLogsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Retourne la liste des événements d audit récents.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAuditLogs([FromQuery] int limit = 10, CancellationToken cancellationToken = default)
    {
        var safeLimit = Math.Clamp(limit, 1, 100);

        var data = await dbContext.AuditLogs
            .AsNoTracking()
            .OrderByDescending(log => log.Timestamp)
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

        return Ok(new { data });
    }
}
