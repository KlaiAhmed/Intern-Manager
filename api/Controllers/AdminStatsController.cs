using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    private const string AdminRole = "Admin,SuperAdmin";
    private const string DashboardReadRole = "Admin,SuperAdmin,Manager";

    /// <summary>
    /// Récupère le nombre de stagiaires actifs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre total de stagiaires avec le statut "actif".
    /// Réservé aux super-administrateurs et accessible aux managers pour la lecture du tableau de bord.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de stagiaires actifs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("interns/active", Name = "GetActiveInterns")]
    [Authorize(Roles = DashboardReadRole)]
    [EnableRateLimiting("read-frequent")]
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
    /// Récupère le nombre de superviseurs actifs.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le nombre total de superviseurs avec le statut "actif".
    /// Réservé aux super-administrateurs et accessible aux managers pour le tableau de bord.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le nombre de superviseurs.</returns>
    /// <response code="200">Nombre récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("supervisors", Name = "GetSupervisorsStats")]
    [Authorize(Roles = DashboardReadRole)]
    [EnableRateLimiting("read-frequent")]
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
            return Ok(new { data = Array.Empty<object>() });
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

        var data = activeInterns
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
            .Select(group => new
            {
                name = group.Key,
                value = group.Count()
            })
            .OrderByDescending(item => item.value)
            .ThenBy(item => item.name)
            .ToList();

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

        var data = countsByType
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

    private Task<int> CountActiveUsersByRoleAsync(UserRole role, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .CountAsync(user => user.Role == role && user.Status == UserStatus.Active, cancellationToken);
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
