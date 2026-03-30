/// <summary>
/// 📁 Emplacement : api/Controllers/StatsController.cs
/// 🎯 Rôle : Fournit les indicateurs utilisés par les tableaux de bord.
/// 📦 Contient : [StatsController]
/// </summary>
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Expose les endpoints statistiques consommés par les vues Dashboard.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour lire les données applicatives.</param>
[ApiController]
[Route("api/stats")]
[Authorize]
public sealed class StatsController(AppDbContext dbContext) : ControllerBase
{
    private const string SuperAdminRole = "SuperAdmin";
    private const string AdminRole = "Admin";
    private const string SupervisorRole = "Supervisor";

    /// <summary>
    /// Retourne le nombre de stagiaires actifs.
    /// </summary>
    [HttpGet("interns/active")]
    [Authorize(Roles = SuperAdminRole)]
    public async Task<IActionResult> GetActiveInternsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Intern, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Retourne le nombre d encadrants actifs.
    /// </summary>
    [HttpGet("supervisors")]
    [Authorize(Roles = SuperAdminRole)]
    public async Task<IActionResult> GetSupervisorsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Supervisor, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Retourne le nombre de missions.
    /// </summary>
    [HttpGet("missions")]
    [Authorize(Roles = SuperAdminRole)]
    public async Task<IActionResult> GetMissionsCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Missions
            .AsNoTracking()
            .CountAsync(cancellationToken);

        return Ok(new { count });
    }

    /// <summary>
    /// Retourne le nombre d administrateurs actifs.
    /// </summary>
    [HttpGet("admins")]
    [Authorize(Roles = SuperAdminRole)]
    public async Task<IActionResult> GetAdminsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Admin, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Retourne la distribution des stagiaires par département.
    /// </summary>
    [HttpGet("interns-by-department")]
    [Authorize(Roles = SuperAdminRole)]
    public async Task<IActionResult> GetInternsByDepartment(CancellationToken cancellationToken)
    {
        var data = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Intern && user.Status == UserStatus.Active)
            .Select(user => new
            {
                DepartmentName = user.Department != null
                    ? user.Department.Name
                    : null
            })
            .GroupBy(entry => string.IsNullOrWhiteSpace(entry.DepartmentName) ? "Unassigned" : entry.DepartmentName!)
            .Select(group => new
            {
                name = group.Key,
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToListAsync(cancellationToken);

        return Ok(new { data });
    }

    /// <summary>
    /// Retourne la distribution des stages par statut.
    /// </summary>
    [HttpGet("internships-by-status")]
    [Authorize(Roles = SuperAdminRole)]
    public async Task<IActionResult> GetInternshipsByStatus(CancellationToken cancellationToken)
    {
        // En attendant l entite Internship, on utilise le statut des comptes stagiaires comme proxy.
        var data = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Intern)
            .GroupBy(user => user.Status)
            .Select(group => new
            {
                name = group.Key.ToString().ToLowerInvariant(),
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToListAsync(cancellationToken);

        return Ok(new { data });
    }

    /// <summary>
    /// Retourne la distribution des stages par type.
    /// </summary>
    [HttpGet("internships-by-type")]
    [Authorize(Roles = SuperAdminRole)]
    public async Task<IActionResult> GetInternshipsByType(CancellationToken cancellationToken)
    {
        // Si des creations de stage sont journalisees avec "type:<value>", on en derive la distribution.
        var loggedTypeValues = await dbContext.AuditLogs
            .AsNoTracking()
            .Where(log => EF.Functions.Like(log.Action, "internship.create%") &&
                          log.Entity != null &&
                          log.Entity != string.Empty)
            .Select(log => log.Entity!)
            .ToListAsync(cancellationToken);

        var typeFromLogs = loggedTypeValues
            .Select(TryExtractInternshipType)
            .Where(typeName => !string.IsNullOrWhiteSpace(typeName))
            .Select(typeName => typeName!)
            .GroupBy(typeName => typeName, StringComparer.OrdinalIgnoreCase)
            .Select(group => new
            {
                name = group.Key,
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToList();

        if (typeFromLogs.Count > 0)
        {
            return Ok(new { data = typeFromLogs });
        }

        // Fallback: expose les types configures avec valeur 0 pour conserver une sortie stable.
        var configuredTypes = await dbContext.InternshipTypes
            .AsNoTracking()
            .OrderBy(type => type.Name)
            .Select(type => new
            {
                name = type.Name,
                value = 0
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data = configuredTypes });
    }

    /// <summary>
    /// Retourne le nombre de stagiaires actifs (vue admin).
    /// </summary>
    [HttpGet("interns/count")]
    [Authorize(Roles = AdminRole)]
    public async Task<IActionResult> GetInternsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Intern, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Retourne le nombre d encadrants actifs (vue admin).
    /// </summary>
    [HttpGet("supervisors/count")]
    [Authorize(Roles = AdminRole)]
    public async Task<IActionResult> GetSupervisorsCountForAdmin(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Supervisor, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Retourne le nombre de stages actifs.
    /// </summary>
    /// <remarks>
    /// Le modèle Stage n est pas encore implémenté.
    /// </remarks>
    [HttpGet("internships/active")]
    [Authorize(Roles = AdminRole)]
    public async Task<IActionResult> GetActiveInternshipsCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Users
            .AsNoTracking()
            .CountAsync(user => user.Role == UserRole.Intern && user.Status == UserStatus.Active, cancellationToken);

        return Ok(new { count });
    }

    /// <summary>
    /// Retourne le nombre de livrables en attente.
    /// </summary>
    /// <remarks>
    /// Le modèle Livrable n est pas encore implémenté.
    /// </remarks>
    [HttpGet("deliverables/pending")]
    [Authorize(Roles = AdminRole)]
    public async Task<IActionResult> GetPendingDeliverablesCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Deliverables
            .AsNoTracking()
            .CountAsync(deliverable => deliverable.Status == "pending" || deliverable.Status == "submitted", cancellationToken);

        return Ok(new { count });
    }

    /// <summary>
    /// Retourne le nombre de stagiaires actifs de l encadrant courant.
    /// </summary>
    /// <remarks>
    /// Les affectations encadrant/stagiaire ne sont pas encore implémentées.
    /// </remarks>
    [HttpGet("supervisor/me/interns/active")]
    [Authorize(Roles = SupervisorRole)]
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
    /// Retourne le nombre de livrables en attente de validation pour l encadrant courant.
    /// </summary>
    /// <remarks>
    /// Les livrables ne sont pas encore implémentés.
    /// </remarks>
    [HttpGet("supervisor/me/deliverables/pending")]
    [Authorize(Roles = SupervisorRole)]
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
    /// Retourne la progression moyenne des stagiaires de l encadrant courant.
    /// </summary>
    /// <remarks>
    /// Les métriques de progression ne sont pas encore implémentées.
    /// </remarks>
    [HttpGet("supervisor/me/avg-progress")]
    [Authorize(Roles = SupervisorRole)]
    public async Task<IActionResult> GetSupervisorAverageProgress(CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var averageProgress = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId.Value)
            .Select(deliverable => (double)Math.Clamp(deliverable.Progress, 0, 100))
            .DefaultIfEmpty(0)
            .AverageAsync(cancellationToken);

        return Ok(new { value = Math.Round(averageProgress, 2) });
    }

    /// <summary>
    /// Retourne le nombre de stagiaires en retard pour l encadrant courant.
    /// </summary>
    /// <remarks>
    /// Le suivi des retards n est pas encore implémenté.
    /// </remarks>
    [HttpGet("supervisor/me/overdue")]
    [Authorize(Roles = SupervisorRole)]
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

    private Task<int> CountActiveUsersByRoleAsync(UserRole role, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .CountAsync(user => user.Role == role && user.Status == UserStatus.Active, cancellationToken);
    }

    private static string? TryExtractInternshipType(string entity)
    {
        if (string.IsNullOrWhiteSpace(entity))
        {
            return null;
        }

        const string marker = "type:";
        var markerIndex = entity.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0)
        {
            return null;
        }

        var valueStart = markerIndex + marker.Length;
        if (valueStart >= entity.Length)
        {
            return null;
        }

        var valueChunk = entity[valueStart..].Trim();
        if (valueChunk.Length == 0)
        {
            return null;
        }

        var separatorIndex = valueChunk.IndexOf(' ');
        var extractedValue = separatorIndex < 0
            ? valueChunk
            : valueChunk[..separatorIndex];

        return string.IsNullOrWhiteSpace(extractedValue)
            ? null
            : extractedValue.Trim();
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
