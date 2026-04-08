/// <summary>
/// 📁 Emplacement : api/Controllers/AdminStatsController.cs
/// 🎯 Rôle : Expose les statistiques globales pour les dashboards administratifs.
/// 📦 Contient : [AdminStatsController]
/// </summary>
using InternManager.Api.Common.Enums;
using InternManager.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de statistiques administratives.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/stats")]
[Authorize]
public sealed class AdminStatsController(AppDbContext dbContext) : ControllerBase
{
    private const string SuperAdminRole = "SuperAdmin";
    private const string AdminRole = "Admin,SuperAdmin";

    /// <summary>
    /// Récupère le nombre de stagiaires actifs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre total de stagiaires avec le statut "actif".
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stagiaires actifs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("interns/active", Name = "GetActiveInterns")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetActiveInternsCount(CancellationToken cancellationToken)
    {
        Response.Headers["Deprecation"] = "true";
        Response.Headers["Sunset"] = "Wed, 31 Dec 2026 23:59:59 GMT";
        Response.Headers["Link"] = "</api/stats/interns/count>; rel=\"successor-version\"";

        return await GetInternsCount(cancellationToken);
    }

    /// <summary>
    /// Récupère le nombre total de stagiaires.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires actifs.
    /// Accessible aux administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stagiaires.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("interns/count", Name = "GetInternsCount")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Intern, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Récupère le nombre de superviseurs actifs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre total de superviseurs avec le statut "actif".
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de superviseurs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("supervisors", Name = "GetSupervisorsStats")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorsCount(CancellationToken cancellationToken)
    {
        Response.Headers["Deprecation"] = "true";
        Response.Headers["Sunset"] = "Wed, 31 Dec 2026 23:59:59 GMT";
        Response.Headers["Link"] = "</api/stats/supervisors/count>; rel=\"successor-version\"";

        return await GetSupervisorsCountForAdmin(cancellationToken);
    }

    /// <summary>
    /// Récupère le nombre total de superviseurs pour les administrateurs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de superviseurs actifs.
    /// Accessible aux administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de superviseurs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("supervisors/count", Name = "GetSupervisorsCount")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorsCountForAdmin(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Supervisor, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Récupère le nombre total de missions.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de missions enregistrées dans le système.
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de missions.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("missions", Name = "GetMissionsStats")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMissionsCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Missions
            .AsNoTracking()
            .CountAsync(cancellationToken);

        return Ok(new { count });
    }

    /// <summary>
    /// Récupère le nombre d administrateurs actifs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre total d administrateurs avec le statut "actif".
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre d administrateurs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("admins", Name = "GetAdminsStats")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAdminsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Admin, cancellationToken);
        return Ok(new { count });
    }

    /// <summary>
    /// Récupère le nombre de stages actifs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires actuellement en stage actif.
    /// Accessible aux administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stages actifs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("internships/active", Name = "GetActiveInternships")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetActiveInternshipsCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Users
            .AsNoTracking()
            .Join(
                dbContext.InternProfiles.AsNoTracking(),
                user => user.Id,
                profile => profile.InternId,
                (user, profile) => new { user, profile })
            .CountAsync(item => item.user.Role == UserRole.Intern && item.user.VerificationStatus == InternVerificationStatus.ACTIVE, cancellationToken);

        return Ok(new { count });
    }

    /// <summary>
    /// Récupère la répartition des stagiaires par département.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires actifs pour chaque département.
    /// Les stagiaires sans département sont regroupés sous "Unassigned".
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de départements avec leur nombre de stagiaires.</returns>
    /// <response code="200">Données récupérées avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("interns-by-department", Name = "GetInternsByDepartment")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsByDepartment(CancellationToken cancellationToken)
    {
        var data = await dbContext.InternProfiles
            .AsNoTracking()
            .Include(profile => profile.Intern)
            .ThenInclude(intern => intern!.Department)
            .Where(profile => profile.Intern != null &&
                              profile.Intern.VerificationStatus == InternVerificationStatus.ACTIVE &&
                              profile.Intern.Role == UserRole.Intern)
            .Select(profile => new
            {
                DepartmentName = profile.Intern!.Department != null
                    ? profile.Intern.Department.Name
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
    /// Récupère la répartition des stagiaires par statut.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires pour chaque statut
    /// (actif, inactif, en attente, etc.).
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de statuts avec leur nombre de stagiaires.</returns>
    /// <response code="200">Données récupérées avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("internships-by-status", Name = "GetInternshipsByStatus")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternshipsByStatus(CancellationToken cancellationToken)
    {
        var raw = await dbContext.InternProfiles
            .AsNoTracking()
            .Include(profile => profile.Intern)
            .Where(profile => profile.Intern != null && profile.Intern.Role == UserRole.Intern)
            .GroupBy(profile => profile.Intern!.VerificationStatus)
            .Select(group => new
            {
                status = group.Key,
                value = group.Count()
            })
            .ToListAsync(cancellationToken);

        var data = raw
            .Select(item => new
            {
                name = item.status.ToString(),
                item.value
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToList();

        return Ok(new { data });
    }

    /// <summary>
    /// Récupère la répartition des stages par type.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stages pour chaque type de stage.
    /// Les données sont extraites des logs d audit de création de stage.
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de types de stage avec leur nombre.</returns>
    /// <response code="200">Données récupérées avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("internships-by-type", Name = "GetInternshipsByType")]
    [Authorize(Roles = SuperAdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternshipsByType(CancellationToken cancellationToken)
    {
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
    /// Récupère le nombre de livrables en attente.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de livrables avec le statut "pending"
    /// ou "submitted" qui n ont pas encore été traités.
    /// Accessible aux administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de livrables en attente.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("deliverables/pending", Name = "GetPendingDeliverablesStats")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPendingDeliverablesCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Deliverables
            .AsNoTracking()
            .CountAsync(deliverable => deliverable.Status == "pending" || deliverable.Status == "submitted", cancellationToken);

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
}
