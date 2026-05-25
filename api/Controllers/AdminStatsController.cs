using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de statistiques administratives.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="cache">Memory cache used for stats responses.</param>
[ApiController]
[Route("api/stats")]
[Authorize]
public sealed class AdminStatsController(AppDbContext dbContext, IMemoryCache cache) : ControllerBase
{
    private const string AdminRole = "Admin,SuperAdmin";
    private const string DashboardReadRole = "Admin,SuperAdmin,Manager";
    private static readonly TimeSpan StatsCacheTtl = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan BiShortStatsCacheTtl = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan BiLongStatsCacheTtl = TimeSpan.FromSeconds(120);
    private const string InternsByDepartmentCacheKey = "stats:interns-by-department";
    private const string InternshipsByStatusCacheKey = "stats:internships-by-status";
    private const string InternshipsByTypeCacheKey = "stats:internships-by-type";
    private const string BiKpiCacheKey = "stats:bi:kpi";
    private const string BiInternFunnelCacheKey = "stats:bi:intern-funnel";
    private const string BiMissionStatsCacheKey = "stats:bi:mission-stats";
    private const string BiEvaluationStatsCacheKey = "stats:bi:evaluation-stats";
    private const string BiDemographicsCacheKey = "stats:bi:demographics";
    private const string BiSupervisorWorkloadCacheKey = "stats:bi:supervisor-workload";
    private const string BiDeliverableStatsCacheKey = "stats:bi:deliverable-stats";
    private const string BiSystemHealthCacheKey = "stats:bi:system-health";
    private const string BiActionQueueCacheKey = "stats:bi:action-queue";

    private sealed record StatSeriesItem(string Name, int Value);

    private async Task<List<StatSeriesItem>> GetOrCreateSeriesAsync(
        string cacheKey,
        Func<Task<List<StatSeriesItem>>> factory)
    {
        if (cache.TryGetValue(cacheKey, out List<StatSeriesItem>? cached) && cached is not null)
        {
            return cached;
        }

        var fresh = await factory();
        cache.Set(cacheKey, fresh, StatsCacheTtl);
        return fresh;
    }

    private async Task<T> GetOrCreateCachedAsync<T>(
        string cacheKey,
        TimeSpan ttl,
        Func<Task<T>> factory)
    {
        if (cache.TryGetValue(cacheKey, out T? cached) && cached is not null)
        {
            return cached;
        }

        var fresh = await factory();
        cache.Set(cacheKey, fresh, ttl);
        return fresh;
    }

/// <summary>
/// Récupère le nombre total de stagiaires.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires actifs.
    /// Accessible aux administrateurs et aux managers.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stagiaires.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("interns/count", Name = "GetInternsCount")]
    [Authorize(Roles = DashboardReadRole)]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsCount(CancellationToken cancellationToken)
    {
        var count = await CountActiveUsersByRoleAsync(UserRole.Intern, cancellationToken);
        return Ok(new { count });
    }

/// <summary>
/// Récupère le nombre total de superviseurs pour les administrateurs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de superviseurs actifs.
    /// Accessible aux administrateurs et aux managers.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de superviseurs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("supervisors/count", Name = "GetSupervisorsCount")]
    [Authorize(Roles = DashboardReadRole)]
    [EnableRateLimiting("read-frequent")]
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
    /// Réservé aux super-administrateurs et accessible aux managers pour le tableau de bord.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de missions.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("missions", Name = "GetMissionsStats")]
    [Authorize(Roles = DashboardReadRole)]
    [EnableRateLimiting("read-frequent")]
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
    /// Récupère les indicateurs publics de la page d accueil.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les compteurs publics utilisés par le héros de la page d accueil.</returns>
    [HttpGet("home", Name = "GetHomeStats")]
    [AllowAnonymous]
    [EnableRateLimiting("read-frequent")]
    [ResponseCache(Duration = 600, Location = ResponseCacheLocation.Any, NoStore = false)]
    [ProducesResponseType(typeof(HomeStatsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHomeStats(CancellationToken cancellationToken)
    {
        var supervisorsCount = await CountActiveUsersByRoleAsync(UserRole.Supervisor, cancellationToken);
        var internsCount = await CountActiveUsersByRoleAsync(UserRole.Intern, cancellationToken);
        var missionsCount = await dbContext.Missions
            .AsNoTracking()
            .CountAsync(cancellationToken);

        return Ok(new HomeStatsResponse
        {
            Supervisors = supervisorsCount,
            Interns = internsCount,
            Missions = missionsCount,
        });
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
    [Authorize(Roles = AdminRole)]
    [EnableRateLimiting("read-frequent")]
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
    /// Accessible aux administrateurs et aux managers.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stages actifs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("internships/active", Name = "GetActiveInternships")]
    [Authorize(Roles = DashboardReadRole)]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetActiveInternshipsCount(CancellationToken cancellationToken)
    {
        var count = await dbContext.Missions
            .AsNoTracking()
            .CountAsync(
                mission => mission.Status == DomainStatuses.Mission.Active &&
                           (mission.InternId.HasValue || mission.InternAssignments.Any()),
                cancellationToken);

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
    [Authorize(Roles = AdminRole)]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsByDepartment(CancellationToken cancellationToken)
    {
        var data = await GetOrCreateSeriesAsync(InternsByDepartmentCacheKey, async () =>
        {
            var activeInterns = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.Role == UserRole.Intern &&
                               user.VerificationStatus == InternVerificationStatus.ACTIVE)
                .Select(user => new
                {
                    user.Id,
                    UserDepartmentName = user.Department != null ? user.Department.Name : null
                })
                .ToListAsync(cancellationToken);

            if (activeInterns.Count == 0)
            {
                return [];
            }

            var activeInternIds = activeInterns
                .Select(item => item.Id)
                .ToList();

            var assignedMissions = await (
                    from assignment in dbContext.MissionInternAssignments.AsNoTracking()
                    join mission in dbContext.Missions.AsNoTracking() on assignment.MissionId equals mission.Id
                    where activeInternIds.Contains(assignment.InternId)
                    select new
                    {
                        mission.Id,
                        InternId = assignment.InternId,
                        mission.Status,
                        mission.CreatedAt
                    })
                .Union(
                    dbContext.Missions
                        .AsNoTracking()
                        .Where(mission => mission.InternId.HasValue && activeInternIds.Contains(mission.InternId.Value))
                        .Select(mission => new
                        {
                            mission.Id,
                            InternId = mission.InternId!.Value,
                            mission.Status,
                            mission.CreatedAt
                        }))
                .ToListAsync(cancellationToken);

            var missionDepartmentById = await LoadLatestMissionFieldValuesAsync(
                assignedMissions.Select(item => item.Id).ToList(),
                "department",
                cancellationToken);

            var preferredMissionByInternId = assignedMissions
                .GroupBy(item => item.InternId)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .OrderByDescending(item => string.Equals(item.Status, DomainStatuses.Mission.Active, StringComparison.OrdinalIgnoreCase))
                        .ThenByDescending(item => item.CreatedAt)
                        .First());

            return activeInterns
                .Select(intern =>
                {
                    preferredMissionByInternId.TryGetValue(intern.Id, out var preferredMission);

                    var departmentFromUser = NormalizeLabel(intern.UserDepartmentName);
                    string? departmentFromMission = null;

                    if (preferredMission is not null &&
                        missionDepartmentById.TryGetValue(preferredMission.Id, out var missionDepartmentValue))
                    {
                        departmentFromMission = NormalizeLabel(missionDepartmentValue);
                    }

                    return ResolveLabelOrFallback(departmentFromUser, departmentFromMission, "Unassigned");
                })
                .GroupBy(label => label, StringComparer.OrdinalIgnoreCase)
                .Select(group => new StatSeriesItem(group.Key, group.Count()))
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .ToList();
        });

        return Ok(new { data });
    }

    /// <summary>
    /// Récupère la répartition des stagiaires par école.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires actifs pour chaque école.
    /// Les stagiaires sans école sont regroupés sous "Unassigned".
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste d écoles avec leur nombre de stagiaires.</returns>
    [HttpGet("interns-by-school", Name = "GetInternsBySchool")]
    [Authorize(Roles = AdminRole)]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsBySchool(CancellationToken cancellationToken)
    {
        var activeInternIds = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Intern &&
                           user.VerificationStatus == InternVerificationStatus.ACTIVE)
            .Select(user => user.Id)
            .ToListAsync(cancellationToken);

        if (activeInternIds.Count == 0)
        {
            return Ok(new { data = Array.Empty<object>() });
        }

        var schoolsByInternId = await (
            from profile in dbContext.InternProfiles.AsNoTracking()
            join school in dbContext.Schools.AsNoTracking()
                on profile.UniversityId equals school.Id into schoolGroup
            from school in schoolGroup.DefaultIfEmpty()
            where activeInternIds.Contains(profile.InternId)
            select new
            {
                profile.InternId,
                SchoolName = school != null ? school.Name : null
            })
            .ToListAsync(cancellationToken);

        var schoolByInternId = schoolsByInternId
            .GroupBy(item => item.InternId)
            .ToDictionary(
                group => group.Key,
                group => NormalizeLabel(group.Select(item => item.SchoolName).FirstOrDefault()));

        var schoolCounts = activeInternIds
            .Select(internId =>
            {
                schoolByInternId.TryGetValue(internId, out var schoolName);
                return string.IsNullOrWhiteSpace(schoolName) ? "Unassigned" : schoolName!;
            })
            .GroupBy(label => label, StringComparer.OrdinalIgnoreCase)
            .Select(group => new
            {
                name = group.Key,
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToList();

        return Ok(new { data = schoolCounts });
    }

    /// <summary>
    /// Récupère la répartition des stagiaires par compétence.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stagiaires actifs associés à chaque compétence.
    /// Les stagiaires sans compétence sont regroupés sous "Unassigned".
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de compétences avec leur nombre de stagiaires.</returns>
    [HttpGet("interns-by-skill", Name = "GetInternsBySkill")]
    [Authorize(Roles = AdminRole)]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternsBySkill(CancellationToken cancellationToken)
    {
        var activeInternIds = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Intern &&
                           user.VerificationStatus == InternVerificationStatus.ACTIVE)
            .Select(user => user.Id)
            .ToListAsync(cancellationToken);

        if (activeInternIds.Count == 0)
        {
            return Ok(new { data = Array.Empty<object>() });
        }

        var profiles = await dbContext.InternProfiles
            .AsNoTracking()
            .Where(profile => activeInternIds.Contains(profile.InternId))
            .Select(profile => new
            {
                profile.Id,
                profile.InternId
            })
            .ToListAsync(cancellationToken);

        var profileIds = profiles
            .Select(profile => profile.Id)
            .ToList();

        var internIdByProfileId = profiles
            .GroupBy(profile => profile.Id)
            .ToDictionary(group => group.Key, group => group.First().InternId);

        var configuredSkillNames = await dbContext.Skills
            .AsNoTracking()
            .OrderBy(skill => skill.Name)
            .Select(skill => skill.Name)
            .ToListAsync(cancellationToken);

        var canonicalSkillNames = configuredSkillNames
            .ToDictionary(name => name, name => name, StringComparer.OrdinalIgnoreCase);

        var skillLinks = profileIds.Count == 0
            ? []
            : await dbContext.InternProfileSkills
                .AsNoTracking()
                .Where(link => profileIds.Contains(link.InternProfileId))
                .Select(link => new
                {
                    link.InternProfileId,
                    SkillName = link.Skill != null ? link.Skill.Name : null
                })
                .ToListAsync(cancellationToken);

        var internsWithAtLeastOneSkill = new HashSet<Guid>();
        var skillCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var link in skillLinks)
        {
            if (!internIdByProfileId.TryGetValue(link.InternProfileId, out var internId))
            {
                continue;
            }

            internsWithAtLeastOneSkill.Add(internId);

            var resolvedSkillName = NormalizeLabel(link.SkillName);
            if (string.IsNullOrWhiteSpace(resolvedSkillName))
            {
                continue;
            }

            if (canonicalSkillNames.TryGetValue(resolvedSkillName, out var canonicalSkillName))
            {
                resolvedSkillName = canonicalSkillName;
            }

            if (!skillCounts.TryAdd(resolvedSkillName, 1))
            {
                skillCounts[resolvedSkillName]++;
            }
        }

        foreach (var configuredSkillName in configuredSkillNames)
        {
            skillCounts.TryAdd(configuredSkillName, 0);
        }

        var unassignedCount = activeInternIds.Count - internsWithAtLeastOneSkill.Count;
        if (unassignedCount > 0)
        {
            if (!skillCounts.TryAdd("Unassigned", unassignedCount))
            {
                skillCounts["Unassigned"] += unassignedCount;
            }
        }

        var data = skillCounts
            .Select(item => new
            {
                name = item.Key,
                value = item.Value
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToList();

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
    [Authorize(Roles = AdminRole)]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternshipsByStatus(CancellationToken cancellationToken)
    {
        var data = await GetOrCreateSeriesAsync(InternshipsByStatusCacheKey, async () =>
        {
            var raw = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.Role == UserRole.Intern)
                .GroupBy(user => user.VerificationStatus)
                .Select(group => new
                {
                    status = group.Key,
                    value = group.Count()
                })
                .ToListAsync(cancellationToken);

            return raw
                .Select(item => new StatSeriesItem(item.status.ToString(), item.value))
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .ToList();
        });

        return Ok(new { data });
    }

    /// <summary>
    /// Récupère la répartition des stages par type.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de stages assignés pour chaque type de stage,
    /// en utilisant les informations de mission et l historique métier.
    /// Réservé aux super-administrateurs.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de types de stage avec leur nombre.</returns>
    /// <response code="200">Données récupérées avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("internships-by-type", Name = "GetInternshipsByType")]
    [Authorize(Roles = AdminRole)]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInternshipsByType(CancellationToken cancellationToken)
    {
        var data = await GetOrCreateSeriesAsync(InternshipsByTypeCacheKey, async () =>
        {
            var configuredTypeNames = await dbContext.InternshipTypes
                .AsNoTracking()
                .OrderBy(type => type.Name)
                .Select(type => type.Name)
                .ToListAsync(cancellationToken);

            var canonicalTypeNames = configuredTypeNames
                .ToDictionary(name => name, name => name, StringComparer.OrdinalIgnoreCase);

            var assignedMissions = await (
                    from assignment in dbContext.MissionInternAssignments.AsNoTracking()
                    join mission in dbContext.Missions.AsNoTracking() on assignment.MissionId equals mission.Id
                    select new
                    {
                        mission.Id,
                        InternId = assignment.InternId,
                        TypeName = mission.InternshipType != null ? mission.InternshipType.Name : null,
                        mission.Level
                    })
                .Union(
                    dbContext.Missions
                        .AsNoTracking()
                        .Where(mission => mission.InternId.HasValue)
                        .Select(mission => new
                        {
                            mission.Id,
                            InternId = mission.InternId!.Value,
                            TypeName = mission.InternshipType != null ? mission.InternshipType.Name : null,
                            mission.Level
                        }))
                .ToListAsync(cancellationToken);

            var missionTypeById = await LoadLatestMissionFieldValuesAsync(
                assignedMissions.Select(item => item.Id).ToList(),
                "type",
                cancellationToken);

            var countsByType = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var mission in assignedMissions)
            {
                missionTypeById.TryGetValue(mission.Id, out var typeFromHistory);

                var resolvedType = NormalizeLabel(typeFromHistory)
                    ?? NormalizeLabel(mission.TypeName)
                    ?? NormalizeLabel(mission.Level)
                    ?? "Unassigned";

                if (canonicalTypeNames.TryGetValue(resolvedType, out var canonicalTypeName))
                {
                    resolvedType = canonicalTypeName;
                }

                if (!countsByType.TryAdd(resolvedType, 1))
                {
                    countsByType[resolvedType]++;
                }
            }

            foreach (var configuredTypeName in configuredTypeNames)
            {
                countsByType.TryAdd(configuredTypeName, 0);
            }

            return countsByType
                .Select(item => new StatSeriesItem(item.Key, item.Value))
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .ToList();
        });

        return Ok(new { data });
    }

    /// <summary>
    /// Récupère le nombre de livrables en attente.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre de livrables avec le statut "pending"
    /// ou "submitted" qui n ont pas encore été traités.
    /// Accessible aux administrateurs et aux managers.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de livrables en attente.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("deliverables/pending", Name = "GetPendingDeliverablesStats")]
    [Authorize(Roles = DashboardReadRole)]
    [EnableRateLimiting("read-frequent")]
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

    [HttpGet("bi/kpi", Name = "GetBiKpiStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiKpiStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiKpiCacheKey, StatsCacheTtl, async () =>
        {
            var utcNow = DateTime.UtcNow;

            var totalInterns = await dbContext.Users
                .AsNoTracking()
                .CountAsync(user => user.Role == UserRole.Intern, cancellationToken);

            var activeInterns = await dbContext.Users
                .AsNoTracking()
                .CountAsync(user => user.Role == UserRole.Intern && user.Status == UserStatus.Active, cancellationToken);

            var pendingVerifications = await dbContext.Users
                .AsNoTracking()
                .CountAsync(
                    user => user.Role == UserRole.Intern &&
                            user.VerificationStatus == InternVerificationStatus.PENDING,
                    cancellationToken);

            var activeMissions = await dbContext.Missions
                .AsNoTracking()
                .CountAsync(mission => mission.Status == DomainStatuses.Mission.Active, cancellationToken);

            var totalMissions = await dbContext.Missions
                .AsNoTracking()
                .CountAsync(mission => mission.Status != DomainStatuses.Mission.Template, cancellationToken);

            var submittedScores = await dbContext.Evaluations
                .AsNoTracking()
                .Where(evaluation => evaluation.Status == DomainStatuses.Evaluation.Submitted)
                .Select(evaluation => new
                {
                    evaluation.Technical,
                    evaluation.Autonomy,
                    evaluation.Communication,
                    evaluation.DeadlineRespect,
                    evaluation.DeliverableQuality
                })
                .ToListAsync(cancellationToken);

            var avgEvaluationScore = submittedScores.Count == 0
                ? 0d
                : submittedScores.Average(score => CalculateOverallScore(
                    score.Technical,
                    score.Autonomy,
                    score.Communication,
                    score.DeadlineRespect,
                    score.DeliverableQuality));

            var supervisorsWithCapacity = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.Role == UserRole.Supervisor &&
                               user.MaxCapacity.HasValue &&
                               user.MaxCapacity.Value > 0)
                .Select(user => new
                {
                    user.Id,
                    MaxCapacity = user.MaxCapacity ?? 0
                })
                .ToListAsync(cancellationToken);

            var activeAssignmentCountsBySupervisor = await GetActiveAssignmentCountsBySupervisorAsync(cancellationToken);
            var supervisorUtilization = supervisorsWithCapacity.Count == 0
                ? 0d
                : supervisorsWithCapacity.Average(supervisor =>
                    activeAssignmentCountsBySupervisor.GetValueOrDefault(supervisor.Id) / (double)supervisor.MaxCapacity * 100d);

            var onboardingCompletionRate = totalInterns == 0
                ? 0d
                : await dbContext.Users
                    .AsNoTracking()
                    .CountAsync(
                        user => user.Role == UserRole.Intern &&
                                user.VerificationStatus == InternVerificationStatus.ACTIVE,
                        cancellationToken) / (double)totalInterns * 100d;

            var pendingDeliverables = await dbContext.Deliverables
                .AsNoTracking()
                .CountAsync(
                    deliverable => deliverable.Status == DomainStatuses.Deliverable.Pending &&
                                   deliverable.DueDate.HasValue &&
                                   deliverable.DueDate.Value < utcNow,
                    cancellationToken);

            var totalSupervisors = await dbContext.Users
                .AsNoTracking()
                .CountAsync(user => user.Role == UserRole.Supervisor, cancellationToken);

            return new
            {
                totalInterns,
                activeInterns,
                pendingVerifications,
                activeMissions,
                totalMissions,
                avgEvaluationScore,
                supervisorUtilization,
                onboardingCompletionRate,
                pendingDeliverables,
                totalSupervisors
            };
        });

        return Ok(new
        {
            stats.totalInterns,
            stats.activeInterns,
            stats.pendingVerifications,
            stats.activeMissions,
            stats.totalMissions,
            stats.avgEvaluationScore,
            stats.supervisorUtilization,
            stats.onboardingCompletionRate,
            stats.pendingDeliverables,
            stats.totalSupervisors
        });
    }

    [HttpGet("bi/intern-funnel", Name = "GetBiInternFunnelStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiInternFunnelStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiInternFunnelCacheKey, StatsCacheTtl, async () =>
        {
            var registered = await dbContext.Users
                .AsNoTracking()
                .CountAsync(user => user.Role == UserRole.Intern, cancellationToken);

            var profileStarted = await dbContext.InternProfiles
                .AsNoTracking()
                .CountAsync(
                    profile => profile.UniversityId.HasValue ||
                               (profile.Major != null && profile.Major != string.Empty),
                    cancellationToken);

            var cvUploaded = await dbContext.InternProfiles
                .AsNoTracking()
                .CountAsync(
                    profile => profile.CvFileUrl != null &&
                               profile.CvFileUrl != string.Empty,
                    cancellationToken);

            var pendingVerification = await dbContext.Users
                .AsNoTracking()
                .CountAsync(
                    user => user.Role == UserRole.Intern &&
                            (user.VerificationStatus == InternVerificationStatus.PENDING ||
                             user.VerificationStatus == InternVerificationStatus.ACTIVE),
                    cancellationToken);

            var verifiedActive = await dbContext.Users
                .AsNoTracking()
                .CountAsync(
                    user => user.Role == UserRole.Intern &&
                            user.VerificationStatus == InternVerificationStatus.ACTIVE,
                    cancellationToken);

            var funnel = new[]
            {
                new { stage = "Registered", value = registered },
                new { stage = "Profile Started", value = profileStarted },
                new { stage = "CV Uploaded", value = cvUploaded },
                new { stage = "Pending Verification", value = pendingVerification },
                new { stage = "Verified & Active", value = verifiedActive }
            }.ToList();

            var verificationStatusRows = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.Role == UserRole.Intern)
                .GroupBy(user => user.VerificationStatus)
                .Select(group => new
                {
                    Status = group.Key,
                    Value = group.Count()
                })
                .ToListAsync(cancellationToken);

            var byVerificationStatus = verificationStatusRows
                .OrderBy(item => item.Status)
                .Select(item => new StatSeriesItem(ToDisplayName(item.Status), item.Value))
                .ToList();

            var workPreferenceRows = await dbContext.InternProfiles
                .AsNoTracking()
                .Where(profile => profile.WorkPreference.HasValue)
                .GroupBy(profile => profile.WorkPreference)
                .Select(group => new
                {
                    Preference = group.Key,
                    Value = group.Count()
                })
                .ToListAsync(cancellationToken);

            var byWorkPreference = workPreferenceRows
                .OrderBy(item => item.Preference)
                .Select(item => new StatSeriesItem(ToDisplayName(item.Preference.GetValueOrDefault()), item.Value))
                .ToList();

            return new
            {
                funnel,
                byVerificationStatus,
                byWorkPreference
            };
        });

        return Ok(new
        {
            stats.funnel,
            stats.byVerificationStatus,
            stats.byWorkPreference
        });
    }

    [HttpGet("bi/mission-stats", Name = "GetBiMissionStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiMissionStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiMissionStatsCacheKey, BiLongStatsCacheTtl, async () =>
        {
            var utcNow = DateTime.UtcNow;
            var months = GetRecentMonthStarts(12, utcNow);
            var firstMonthStart = months.First();

            var byStatusRows = await dbContext.Missions
                .AsNoTracking()
                .Where(mission => mission.Status != DomainStatuses.Mission.Template)
                .GroupBy(mission => mission.Status)
                .Select(group => new
                {
                    Status = group.Key,
                    Value = group.Count()
                })
                .ToListAsync(cancellationToken);

            var byStatus = byStatusRows
                .Select(item => new StatSeriesItem(item.Status, item.Value))
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .ToList();

            var byTypeRows = await (
                    from mission in dbContext.Missions.AsNoTracking()
                    join internshipType in dbContext.InternshipTypes.AsNoTracking()
                        on mission.InternshipTypeId equals (Guid?)internshipType.Id
                    group internshipType by internshipType.Name into groupByType
                    select new
                    {
                        Name = groupByType.Key,
                        Value = groupByType.Count()
                    })
                .ToListAsync(cancellationToken);

            var byType = byTypeRows
                .Select(item => new StatSeriesItem(item.Name, item.Value))
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .ToList();

            var missionTimelineSource = await dbContext.Missions
                .AsNoTracking()
                .Where(mission => mission.CreatedAt >= firstMonthStart ||
                                  (mission.EndDate.HasValue && mission.EndDate.Value >= firstMonthStart))
                .Select(mission => new
                {
                    mission.CreatedAt,
                    mission.Status,
                    mission.EndDate
                })
                .ToListAsync(cancellationToken);

            var timeline = months
                .Select(monthStart =>
                {
                    var nextMonthStart = monthStart.AddMonths(1);
                    var created = missionTimelineSource.Count(item =>
                        item.CreatedAt >= monthStart && item.CreatedAt < nextMonthStart);
                    var completed = missionTimelineSource.Count(item =>
                        item.EndDate.HasValue &&
                        item.EndDate.Value >= monthStart &&
                        item.EndDate.Value < nextMonthStart &&
                        string.Equals(item.Status, DomainStatuses.Mission.Completed, StringComparison.OrdinalIgnoreCase));
                    var cancelled = missionTimelineSource.Count(item =>
                        item.EndDate.HasValue &&
                        item.EndDate.Value >= monthStart &&
                        item.EndDate.Value < nextMonthStart &&
                        string.Equals(item.Status, DomainStatuses.Mission.Cancelled, StringComparison.OrdinalIgnoreCase));

                    return new
                    {
                        month = FormatMonth(monthStart),
                        created,
                        completed,
                        cancelled
                    };
                })
                .ToList();

            var completionRateByMonth = timeline
                .Select(item =>
                {
                    var denominator = item.completed + item.cancelled;
                    var rate = denominator == 0
                        ? 0d
                        : item.completed / (double)denominator * 100d;

                    return new
                    {
                        item.month,
                        rate
                    };
                })
                .ToList();

            var avgDurationDays = await dbContext.Missions
                .AsNoTracking()
                .Where(mission => mission.StartDate.HasValue && mission.EndDate.HasValue)
                .Select(mission => (double?)EF.Functions.DateDiffDay(mission.StartDate!.Value, mission.EndDate!.Value))
                .AverageAsync(cancellationToken) ?? 0d;

            var totalActive = await dbContext.Missions
                .AsNoTracking()
                .CountAsync(mission => mission.Status == DomainStatuses.Mission.Active, cancellationToken);

            return new
            {
                byStatus,
                byType,
                timeline,
                completionRateByMonth,
                avgDurationDays,
                totalActive
            };
        });

        return Ok(new
        {
            stats.byStatus,
            stats.byType,
            stats.timeline,
            stats.completionRateByMonth,
            stats.avgDurationDays,
            stats.totalActive
        });
    }

    [HttpGet("bi/evaluation-stats", Name = "GetBiEvaluationStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiEvaluationStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiEvaluationStatsCacheKey, StatsCacheTtl, async () =>
        {
            var utcNow = DateTime.UtcNow;
            var months = GetRecentMonthStarts(12, utcNow);
            var firstMonthStart = months.First();

            var submittedEvaluations = await dbContext.Evaluations
                .AsNoTracking()
                .Where(evaluation => evaluation.Status == DomainStatuses.Evaluation.Submitted)
                .Select(evaluation => new
                {
                    evaluation.InternId,
                    evaluation.Technical,
                    evaluation.Autonomy,
                    evaluation.Communication,
                    evaluation.DeadlineRespect,
                    evaluation.DeliverableQuality,
                    evaluation.SubmittedAt
                })
                .ToListAsync(cancellationToken);

            var avgScores = submittedEvaluations.Count == 0
                ? new
                {
                    technical = 0d,
                    autonomy = 0d,
                    communication = 0d,
                    deadlineRespect = 0d,
                    deliverableQuality = 0d
                }
                : new
                {
                    technical = submittedEvaluations.Average(item => item.Technical),
                    autonomy = submittedEvaluations.Average(item => item.Autonomy),
                    communication = submittedEvaluations.Average(item => item.Communication),
                    deadlineRespect = submittedEvaluations.Average(item => item.DeadlineRespect),
                    deliverableQuality = submittedEvaluations.Average(item => item.DeliverableQuality)
                };

            var overallScores = submittedEvaluations
                .Select(item => CalculateOverallScore(
                    item.Technical,
                    item.Autonomy,
                    item.Communication,
                    item.DeadlineRespect,
                    item.DeliverableQuality))
                .ToList();

            var distribution = new[]
            {
                new { range = "1.0–1.9", count = overallScores.Count(score => score < 2d) },
                new { range = "2.0–2.9", count = overallScores.Count(score => score >= 2d && score < 3d) },
                new { range = "3.0–3.9", count = overallScores.Count(score => score >= 3d && score < 4d) },
                new { range = "4.0–5.0", count = overallScores.Count(score => score >= 4d) }
            }.ToList();

            var submittedEvaluationsByMonth = submittedEvaluations
                .Where(item => item.SubmittedAt.HasValue && item.SubmittedAt.Value >= firstMonthStart)
                .ToList();

            var byMonth = months
                .Select(monthStart =>
                {
                    var nextMonthStart = monthStart.AddMonths(1);
                    var rows = submittedEvaluationsByMonth
                        .Where(item => item.SubmittedAt.HasValue &&
                                       item.SubmittedAt.Value >= monthStart &&
                                       item.SubmittedAt.Value < nextMonthStart)
                        .ToList();
                    var count = rows.Count;
                    var avgOverall = count == 0
                        ? 0d
                        : rows.Average(item => CalculateOverallScore(
                            item.Technical,
                            item.Autonomy,
                            item.Communication,
                            item.DeadlineRespect,
                            item.DeliverableQuality));

                    return new
                    {
                        month = FormatMonth(monthStart),
                        avgOverall,
                        count
                    };
                })
                .ToList();

            var topInternScores = submittedEvaluations
                .GroupBy(item => item.InternId)
                .Select(group => new
                {
                    internId = group.Key,
                    avgScore = group.Average(item => CalculateOverallScore(
                        item.Technical,
                        item.Autonomy,
                        item.Communication,
                        item.DeadlineRespect,
                        item.DeliverableQuality)),
                    evaluationCount = group.Count()
                })
                .OrderByDescending(item => item.avgScore)
                .ThenByDescending(item => item.evaluationCount)
                .Take(10)
                .ToList();

            var topInternIds = topInternScores
                .Select(item => item.internId)
                .ToList();

            var topInternNameRows = await dbContext.Users
                .AsNoTracking()
                .Where(user => topInternIds.Contains(user.Id))
                .Select(user => new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName
                })
                .ToListAsync(cancellationToken);

            var internNamesById = topInternNameRows
                .ToDictionary(
                    item => item.Id,
                    item => FormatFullName(item.FirstName, item.LastName));

            var topInterns = topInternScores
                .Select(item => new
                {
                    item.internId,
                    name = internNamesById.GetValueOrDefault(item.internId) ?? "Unknown",
                    item.avgScore,
                    item.evaluationCount
                })
                .ToList();

            var statusCountsByStatus = await dbContext.Evaluations
                .AsNoTracking()
                .GroupBy(evaluation => evaluation.Status)
                .Select(group => new
                {
                    Status = group.Key,
                    Count = group.Count()
                })
                .ToDictionaryAsync(item => item.Status, item => item.Count, cancellationToken);

            var statusCounts = new
            {
                pending = statusCountsByStatus.GetValueOrDefault(DomainStatuses.Evaluation.Pending),
                submitted = statusCountsByStatus.GetValueOrDefault(DomainStatuses.Evaluation.Submitted)
            };

            return new
            {
                avgScores,
                distribution,
                byMonth,
                topInterns,
                statusCounts
            };
        });

        return Ok(new
        {
            stats.avgScores,
            stats.distribution,
            stats.byMonth,
            stats.topInterns,
            stats.statusCounts
        });
    }

    [HttpGet("bi/demographics", Name = "GetBiDemographicsStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiDemographicsStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiDemographicsCacheKey, BiLongStatsCacheTtl, async () =>
        {
            var majorValues = await (
                    from user in dbContext.Users.AsNoTracking()
                    join profile in dbContext.InternProfiles.AsNoTracking() on user.Id equals profile.InternId
                    where user.Role == UserRole.Intern &&
                          profile.Major != null &&
                          profile.Major != string.Empty
                    select profile.Major)
                .ToListAsync(cancellationToken);

            var byMajor = BuildSeriesFromLabels(majorValues);

            var yearValues = await (
                    from user in dbContext.Users.AsNoTracking()
                    join profile in dbContext.InternProfiles.AsNoTracking() on user.Id equals profile.InternId
                    where user.Role == UserRole.Intern &&
                          profile.CurrentYearOfStudy != null &&
                          profile.CurrentYearOfStudy != string.Empty
                    select profile.CurrentYearOfStudy)
                .ToListAsync(cancellationToken);

            var byYearOfStudy = BuildSeriesFromLabels(yearValues.Select(FormatYearOfStudy));

            var workPreferenceRows = await (
                    from user in dbContext.Users.AsNoTracking()
                    join profile in dbContext.InternProfiles.AsNoTracking() on user.Id equals profile.InternId
                    where user.Role == UserRole.Intern && profile.WorkPreference.HasValue
                    group profile by profile.WorkPreference into groupByPreference
                    select new
                    {
                        Preference = groupByPreference.Key,
                        Value = groupByPreference.Count()
                    })
                .ToListAsync(cancellationToken);

            var byWorkPreference = workPreferenceRows
                .OrderBy(item => item.Preference)
                .Select(item => new StatSeriesItem(ToDisplayName(item.Preference.GetValueOrDefault()), item.Value))
                .ToList();

            var universityRows = await (
                    from user in dbContext.Users.AsNoTracking()
                    join profile in dbContext.InternProfiles.AsNoTracking() on user.Id equals profile.InternId
                    join school in dbContext.Schools.AsNoTracking()
                        on profile.UniversityId equals (Guid?)school.Id
                    where user.Role == UserRole.Intern
                    group school by school.Name into groupBySchool
                    select new
                    {
                        Name = groupBySchool.Key,
                        Value = groupBySchool.Count()
                    })
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .Take(10)
                .ToListAsync(cancellationToken);

            var byUniversity = universityRows
                .Select(item => new StatSeriesItem(item.Name, item.Value))
                .ToList();

            var departmentRows = await (
                    from user in dbContext.Users.AsNoTracking()
                    join department in dbContext.Departments.AsNoTracking()
                        on user.DepartmentId equals (Guid?)department.Id
                    where user.Role == UserRole.Intern && user.DepartmentId.HasValue
                    group department by department.Name into groupByDepartment
                    select new
                    {
                        Name = groupByDepartment.Key,
                        Value = groupByDepartment.Count()
                    })
                .ToListAsync(cancellationToken);

            var byDepartment = departmentRows
                .Select(item => new StatSeriesItem(item.Name, item.Value))
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .ToList();

            return new
            {
                byMajor,
                byYearOfStudy,
                byWorkPreference,
                byUniversity,
                byDepartment
            };
        });

        return Ok(new
        {
            stats.byMajor,
            stats.byYearOfStudy,
            stats.byWorkPreference,
            stats.byUniversity,
            stats.byDepartment
        });
    }

    [HttpGet("bi/supervisor-workload", Name = "GetBiSupervisorWorkloadStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiSupervisorWorkloadStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiSupervisorWorkloadCacheKey, BiShortStatsCacheTtl, async () =>
        {
            var supervisorRows = await (
                    from supervisor in dbContext.Users.AsNoTracking()
                    join department in dbContext.Departments.AsNoTracking()
                        on supervisor.DepartmentId equals (Guid?)department.Id into departmentGroup
                    from department in departmentGroup.DefaultIfEmpty()
                    where supervisor.Role == UserRole.Supervisor
                    select new
                    {
                        supervisor.Id,
                        supervisor.FirstName,
                        supervisor.LastName,
                        Department = department != null ? department.Name : null,
                        supervisor.MaxCapacity
                    })
                .ToListAsync(cancellationToken);

            var activeAssignmentCountsBySupervisor = await GetActiveAssignmentCountsBySupervisorAsync(cancellationToken);
            var supervisors = supervisorRows
                .Select(supervisor =>
                {
                    var assignedInterns = activeAssignmentCountsBySupervisor.GetValueOrDefault(supervisor.Id);
                    var utilization = supervisor.MaxCapacity.HasValue && supervisor.MaxCapacity.Value > 0
                        ? assignedInterns / (double)supervisor.MaxCapacity.Value * 100d
                        : 0d;

                    return new
                    {
                        id = supervisor.Id,
                        name = FormatFullName(supervisor.FirstName, supervisor.LastName),
                        department = NormalizeLabel(supervisor.Department) ?? "Unassigned",
                        assignedInterns,
                        maxCapacity = supervisor.MaxCapacity,
                        utilization
                    };
                })
                .OrderByDescending(supervisor => supervisor.utilization)
                .ThenBy(supervisor => supervisor.name)
                .ToList();

            var capacityConstrainedSupervisors = supervisors
                .Where(supervisor => supervisor.maxCapacity.HasValue && supervisor.maxCapacity.Value > 0)
                .ToList();

            var overallUtilization = capacityConstrainedSupervisors.Count == 0
                ? 0d
                : capacityConstrainedSupervisors.Average(supervisor => supervisor.utilization);

            var overCapacityCount = capacityConstrainedSupervisors
                .Count(supervisor => supervisor.assignedInterns > supervisor.maxCapacity!.Value);

            var unassignedInterns = await CountUnassignedVerifiedInternsAsync(cancellationToken);

            return new
            {
                supervisors,
                overallUtilization,
                overCapacityCount,
                unassignedInterns
            };
        });

        return Ok(new
        {
            stats.supervisors,
            stats.overallUtilization,
            stats.overCapacityCount,
            stats.unassignedInterns
        });
    }

    [HttpGet("bi/deliverable-stats", Name = "GetBiDeliverableStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiDeliverableStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiDeliverableStatsCacheKey, StatsCacheTtl, async () =>
        {
            var utcNow = DateTime.UtcNow;
            var currentWeekStart = GetWeekStart(utcNow);
            var weekStarts = Enumerable
                .Range(0, 12)
                .Select(index => currentWeekStart.AddDays(-7 * (11 - index)))
                .ToList();
            var firstWeekStart = weekStarts.First();

            var byStatusRows = await dbContext.Deliverables
                .AsNoTracking()
                .GroupBy(deliverable => deliverable.Status)
                .Select(group => new
                {
                    Status = group.Key,
                    Value = group.Count()
                })
                .ToListAsync(cancellationToken);

            var byStatus = byStatusRows
                .Select(item => new StatSeriesItem(item.Status, item.Value))
                .OrderByDescending(item => item.Value)
                .ThenBy(item => item.Name)
                .ToList();

            var overdueCount = await dbContext.Deliverables
                .AsNoTracking()
                .CountAsync(
                    deliverable => deliverable.DueDate.HasValue &&
                                   deliverable.DueDate.Value < utcNow &&
                                   deliverable.Status == DomainStatuses.Deliverable.Pending,
                    cancellationToken);

            var submissionRows = await dbContext.Deliverables
                .AsNoTracking()
                .Where(deliverable => deliverable.SubmittedDate.HasValue &&
                                      deliverable.SubmittedDate.Value >= firstWeekStart)
                .Select(deliverable => new
                {
                    deliverable.SubmittedDate,
                    deliverable.Status
                })
                .ToListAsync(cancellationToken);

            var submissionsByWeek = weekStarts
                .Select(weekStart =>
                {
                    var nextWeekStart = weekStart.AddDays(7);
                    var rows = submissionRows
                        .Where(item => item.SubmittedDate.HasValue &&
                                       item.SubmittedDate.Value >= weekStart &&
                                       item.SubmittedDate.Value < nextWeekStart)
                        .ToList();

                    return new
                    {
                        week = FormatDate(weekStart),
                        submitted = rows.Count(item => string.Equals(item.Status, DomainStatuses.Deliverable.Submitted, StringComparison.OrdinalIgnoreCase)),
                        accepted = rows.Count(item => string.Equals(item.Status, DomainStatuses.Deliverable.Accepted, StringComparison.OrdinalIgnoreCase)),
                        rejected = rows.Count(item => string.Equals(item.Status, DomainStatuses.Deliverable.Rejected, StringComparison.OrdinalIgnoreCase))
                    };
                })
                .ToList();

            var journalStart = utcNow.AddDays(-90);
            var journalEntryDates = await dbContext.JournalEntries
                .AsNoTracking()
                .Where(entry => entry.CreatedAt >= journalStart)
                .Select(entry => entry.CreatedAt)
                .ToListAsync(cancellationToken);

            var journalActivityByDay = journalEntryDates
                .GroupBy(date => date.Date)
                .Select(group => new
                {
                    date = FormatDate(group.Key),
                    count = group.Count()
                })
                .OrderBy(item => item.date)
                .ToList();

            return new
            {
                byStatus,
                overdueCount,
                submissionsByWeek,
                journalActivityByDay
            };
        });

        return Ok(new
        {
            stats.byStatus,
            stats.overdueCount,
            stats.submissionsByWeek,
            stats.journalActivityByDay
        });
    }

    [HttpGet("bi/system-health", Name = "GetBiSystemHealthStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiSystemHealthStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiSystemHealthCacheKey, StatsCacheTtl, async () =>
        {
            var utcNow = DateTime.UtcNow;

            var userRows = await dbContext.Users
                .AsNoTracking()
                .Select(user => new
                {
                    user.CreatedAt,
                    user.Role
                })
                .ToListAsync(cancellationToken);

            var cumulative = 0;
            var userGrowthByMonth = userRows
                .GroupBy(user => new { user.CreatedAt.Year, user.CreatedAt.Month })
                .OrderBy(group => group.Key.Year)
                .ThenBy(group => group.Key.Month)
                .Select(group =>
                {
                    var monthCount = group.Count();
                    cumulative += monthCount;
                    var monthStart = new DateTime(group.Key.Year, group.Key.Month, 1, 0, 0, 0, DateTimeKind.Utc);

                    return new
                    {
                        month = FormatMonth(monthStart),
                        interns = group.Count(user => user.Role == UserRole.Intern),
                        supervisors = group.Count(user => user.Role == UserRole.Supervisor),
                        admins = group.Count(user => user.Role is UserRole.Admin or UserRole.SuperAdmin),
                        cumulative
                    };
                })
                .ToList();

            var activeSessionsCount = await dbContext.RefreshTokens
                .AsNoTracking()
                .CountAsync(
                    token => token.RevokedAt == null &&
                             token.ExpiresAt > utcNow,
                    cancellationToken);

            var auditStart = utcNow.AddDays(-30);
            var auditLogDates = await dbContext.AuditLogs
                .AsNoTracking()
                .Where(log => log.Timestamp >= auditStart)
                .Select(log => log.Timestamp)
                .ToListAsync(cancellationToken);

            var auditLogByDay = auditLogDates
                .GroupBy(timestamp => timestamp.Date)
                .Select(group => new
                {
                    date = FormatDate(group.Key),
                    count = group.Count()
                })
                .OrderBy(item => item.date)
                .ToList();

            var auditByAction = await dbContext.AuditLogs
                .AsNoTracking()
                .GroupBy(log => log.Action)
                .Select(group => new
                {
                    action = group.Key,
                    count = group.Count()
                })
                .OrderByDescending(item => item.count)
                .ThenBy(item => item.action)
                .Take(10)
                .ToListAsync(cancellationToken);

            var totalUsers = userRows.Count;
            var usersByRole = userRows
                .GroupBy(user => user.Role)
                .OrderBy(group => group.Key)
                .Select(group => new
                {
                    role = group.Key.ToString(),
                    count = group.Count()
                })
                .ToList();

            return new
            {
                userGrowthByMonth,
                activeSessionsCount,
                auditLogByDay,
                auditByAction,
                totalUsers,
                usersByRole
            };
        });

        return Ok(new
        {
            stats.userGrowthByMonth,
            stats.activeSessionsCount,
            stats.auditLogByDay,
            stats.auditByAction,
            stats.totalUsers,
            stats.usersByRole
        });
    }

    [HttpGet("bi/action-queue", Name = "GetBiActionQueueStats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBiActionQueueStats(CancellationToken cancellationToken)
    {
        var stats = await GetOrCreateCachedAsync(BiActionQueueCacheKey, BiShortStatsCacheTtl, async () =>
        {
            var utcNow = DateTime.UtcNow;
            var endingSoonThreshold = utcNow.AddDays(7);

            var pendingVerifications = await dbContext.Users
                .AsNoTracking()
                .CountAsync(
                    user => user.Role == UserRole.Intern &&
                            user.VerificationStatus == InternVerificationStatus.PENDING,
                    cancellationToken);

            var pendingEvaluations = await dbContext.Evaluations
                .AsNoTracking()
                .CountAsync(evaluation => evaluation.Status == DomainStatuses.Evaluation.Submitted, cancellationToken);

            var missionsEndingSoon = await (
                    from mission in dbContext.Missions.AsNoTracking()
                    join intern in dbContext.Users.AsNoTracking()
                        on mission.InternId equals (Guid?)intern.Id into internGroup
                    from intern in internGroup.DefaultIfEmpty()
                    where mission.Status == DomainStatuses.Mission.Active &&
                          mission.EndDate.HasValue &&
                          mission.EndDate.Value >= utcNow &&
                          mission.EndDate.Value <= endingSoonThreshold
                    orderby mission.EndDate
                    select new
                    {
                        id = mission.Id,
                        title = mission.Title,
                        endDate = mission.EndDate!.Value,
                        internName = intern == null ? null : (intern.FirstName + " " + intern.LastName).Trim()
                    })
                .ToListAsync(cancellationToken);

            var unassignedVerifiedInterns = await CountUnassignedVerifiedInternsAsync(cancellationToken);

            var overdueDeliverables = await dbContext.Deliverables
                .AsNoTracking()
                .CountAsync(
                    deliverable => deliverable.DueDate.HasValue &&
                                   deliverable.DueDate.Value < utcNow &&
                                   deliverable.Status == DomainStatuses.Deliverable.Pending,
                    cancellationToken);

            var items = new[]
            {
                new
                {
                    type = "PENDING_VERIFICATION",
                    priority = "high",
                    message = $"{pendingVerifications} interns awaiting verification",
                    count = pendingVerifications,
                    actionUrl = "/admin/interns?filter=pending"
                },
                new
                {
                    type = "PENDING_EVALUATIONS",
                    priority = "high",
                    message = $"{pendingEvaluations} evaluations awaiting approval",
                    count = pendingEvaluations,
                    actionUrl = "/admin/evaluations?filter=pending"
                },
                new
                {
                    type = "MISSIONS_ENDING",
                    priority = "medium",
                    message = $"{missionsEndingSoon.Count} missions end within 7 days",
                    count = missionsEndingSoon.Count,
                    actionUrl = "/admin/missions?filter=ending-soon"
                },
                new
                {
                    type = "UNASSIGNED_INTERNS",
                    priority = "medium",
                    message = $"{unassignedVerifiedInterns} verified interns without an active mission",
                    count = unassignedVerifiedInterns,
                    actionUrl = "/admin/interns?filter=unassigned"
                },
                new
                {
                    type = "OVERDUE_DELIVERABLES",
                    priority = "low",
                    message = $"{overdueDeliverables} overdue deliverables",
                    count = overdueDeliverables,
                    actionUrl = "/admin/deliverables?filter=overdue"
                }
            }
                .OrderBy(item => GetPriorityOrder(item.priority))
                .ThenByDescending(item => item.count)
                .ToList();

            return new
            {
                pendingVerifications,
                pendingEvaluations,
                missionsEndingSoon,
                unassignedVerifiedInterns,
                overdueDeliverables,
                items
            };
        });

        return Ok(new
        {
            stats.pendingVerifications,
            stats.pendingEvaluations,
            stats.missionsEndingSoon,
            stats.unassignedVerifiedInterns,
            stats.overdueDeliverables,
            stats.items
        });
    }

    private Task<int> CountActiveUsersByRoleAsync(UserRole role, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .CountAsync(user => user.Role == role && user.Status == UserStatus.Active, cancellationToken);
    }

    private async Task<Dictionary<Guid, int>> GetActiveAssignmentCountsBySupervisorAsync(CancellationToken cancellationToken)
    {
        return await (
                from mission in dbContext.Missions.AsNoTracking()
                join assignment in dbContext.MissionInternAssignments.AsNoTracking()
                    on mission.Id equals assignment.MissionId
                where mission.Status == DomainStatuses.Mission.Active
                group assignment by mission.SupervisorId into groupBySupervisor
                select new
                {
                    SupervisorId = groupBySupervisor.Key,
                    AssignedCount = groupBySupervisor.Count()
                })
            .ToDictionaryAsync(item => item.SupervisorId, item => item.AssignedCount, cancellationToken);
    }

    private Task<int> CountUnassignedVerifiedInternsAsync(CancellationToken cancellationToken)
    {
        var activeAssignedInternIds =
            from assignment in dbContext.MissionInternAssignments.AsNoTracking()
            join mission in dbContext.Missions.AsNoTracking() on assignment.MissionId equals mission.Id
            where mission.Status == DomainStatuses.Mission.Active
            select assignment.InternId;

        return dbContext.Users
            .AsNoTracking()
            .CountAsync(
                user => user.Role == UserRole.Intern &&
                        user.VerificationStatus == InternVerificationStatus.ACTIVE &&
                        !activeAssignedInternIds.Contains(user.Id),
                cancellationToken);
    }

    private static double CalculateOverallScore(
        int technical,
        int autonomy,
        int communication,
        int deadlineRespect,
        int deliverableQuality)
    {
        return (technical + autonomy + communication + deadlineRespect + deliverableQuality) / 5.0;
    }

    private static List<DateTime> GetRecentMonthStarts(int monthCount, DateTime utcNow)
    {
        var currentMonthStart = new DateTime(utcNow.Year, utcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        return Enumerable
            .Range(0, monthCount)
            .Select(index => currentMonthStart.AddMonths(-(monthCount - 1 - index)))
            .ToList();
    }

    private static DateTime GetWeekStart(DateTime value)
    {
        var date = value.Date;
        var dayOffset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-dayOffset);
    }

    private static string FormatMonth(DateTime value)
    {
        return value.ToString("yyyy-MM", CultureInfo.InvariantCulture);
    }

    private static string FormatDate(DateTime value)
    {
        return value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static string ToDisplayName(Enum value)
    {
        var normalized = value.ToString().Replace('_', ' ').ToLowerInvariant();
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(normalized);
    }

    private static string FormatFullName(string firstName, string lastName)
    {
        var fullName = $"{firstName} {lastName}".Trim();
        return string.IsNullOrWhiteSpace(fullName) ? "Unknown" : fullName;
    }

    private static string? FormatYearOfStudy(string? value)
    {
        var normalized = NormalizeLabel(value);
        if (normalized is null)
        {
            return null;
        }

        return int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var year)
            ? $"Year {year}"
            : normalized;
    }

    private static List<StatSeriesItem> BuildSeriesFromLabels(IEnumerable<string?> labels)
    {
        return labels
            .Select(NormalizeLabel)
            .Where(label => label is not null)
            .Select(label => label!)
            .GroupBy(label => label, StringComparer.OrdinalIgnoreCase)
            .Select(group => new StatSeriesItem(group.Key, group.Count()))
            .OrderByDescending(item => item.Value)
            .ThenBy(item => item.Name)
            .ToList();
    }

    private static int GetPriorityOrder(string priority)
    {
        return priority switch
        {
            "high" => 0,
            "medium" => 1,
            "low" => 2,
            _ => 3
        };
    }

    private async Task<Dictionary<Guid, string?>> LoadLatestMissionFieldValuesAsync(
        IReadOnlyCollection<Guid> missionIds,
        string field,
        CancellationToken cancellationToken)
    {
        if (missionIds.Count == 0)
        {
            return new Dictionary<Guid, string?>();
        }

        var entries = await dbContext.MissionHistoryEntries
            .AsNoTracking()
            .Where(entry => missionIds.Contains(entry.MissionId) && entry.Field == field)
            .OrderByDescending(entry => entry.ChangedAt)
            .Select(entry => new
            {
                entry.MissionId,
                entry.NewValue
            })
            .ToListAsync(cancellationToken);

        return entries
            .GroupBy(entry => entry.MissionId)
            .ToDictionary(
                group => group.Key,
                group => NormalizeLabel(group.Select(entry => entry.NewValue).FirstOrDefault()));
    }

    private static string? NormalizeLabel(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static string ResolveLabelOrFallback(string? primary, string? secondary, string fallback)
    {
        if (!string.IsNullOrWhiteSpace(primary))
        {
            return primary;
        }

        if (!string.IsNullOrWhiteSpace(secondary))
        {
            return secondary;
        }

        return fallback;
    }
}
