using System.Text.Json;
using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des missions du superviseur.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="notificationService">Service pour envoyer des notifications.</param>
[ApiController]
[Route("api/missions")]
// RBAC policy: endpoints available to Supervisor must also be available to Admin and SuperAdmin.
[Authorize]
public sealed class MissionsController(AppDbContext dbContext, INotificationService notificationService) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des missions du superviseur connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les missions créées par le superviseur.
    /// Chaque mission peut être un modèle (sans stagiaire assigné) ou active (avec un stagiaire).
    /// Les résultats sont triés par date de création, du plus récent au plus ancien.
    /// </remarks>
    /// <param name="supervisorId">Optionnel : filtre par identifiant de superviseur.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée de missions.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListMissions")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyMissions(
        [FromQuery] string? supervisorId = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin") || User.IsInRole("Manager");
        Guid? effectiveSupervisorId = null;

        if (isAdminScope)
        {
            if (string.Equals(supervisorId, "me", StringComparison.OrdinalIgnoreCase))
            {
                effectiveSupervisorId = currentUserId.Value;
            }
            else if (!string.IsNullOrWhiteSpace(supervisorId))
            {
                if (!Guid.TryParse(supervisorId, out var parsedSupervisorId))
                {
                    return BadRequest(new { message = "Invalid supervisorId filter." });
                }

                effectiveSupervisorId = parsedSupervisorId;
            }
        }
        else
        {
            if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentUserId.Value))
            {
                return Forbid();
            }

            effectiveSupervisorId = currentUserId.Value;
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var missionsQuery = dbContext.Missions
            .AsNoTracking()
            .Include(mission => mission.Intern)
            .Include(mission => mission.InternAssignments)
                .ThenInclude(assignment => assignment.Intern)
            .Include(mission => mission.Supervisor)
            .AsQueryable();

        if (effectiveSupervisorId.HasValue)
        {
            missionsQuery = missionsQuery.Where(mission => mission.SupervisorId == effectiveSupervisorId.Value);
        }

        var total = await missionsQuery.CountAsync(cancellationToken);

        var missions = await missionsQuery
            .OrderByDescending(mission => mission.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var missionIds = missions.Select(mission => mission.Id).ToList();
        var deliverableCountsByMissionId = missionIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await dbContext.Deliverables
                .AsNoTracking()
                .Where(deliverable => missionIds.Contains(deliverable.MissionId))
                .GroupBy(deliverable => deliverable.MissionId)
                .Select(group => new { missionId = group.Key, count = group.Count() })
                .ToDictionaryAsync(item => item.missionId, item => item.count, cancellationToken);

        var data = missions.Select(mission =>
        {
            var deliverablesCount = deliverableCountsByMissionId.TryGetValue(mission.Id, out var count)
                ? count
                : 0;

            var assignedInterns = mission.InternAssignments
                .Select(assignment => new
                {
                    assignment.InternId,
                    FullName = assignment.Intern != null
                        ? $"{assignment.Intern.FirstName} {assignment.Intern.LastName}".Trim()
                        : string.Empty
                })
                .Where(item => item.InternId != Guid.Empty)
                .OrderBy(item => item.FullName)
                .ToList();

            if (assignedInterns.Count == 0 && mission.InternId.HasValue)
            {
                assignedInterns.Add(new
                {
                    InternId = mission.InternId.Value,
                    FullName = mission.Intern != null
                        ? $"{mission.Intern.FirstName} {mission.Intern.LastName}".Trim()
                        : string.Empty
                });
            }

            var internIds = assignedInterns
                .Select(item => item.InternId)
                .Distinct()
                .ToArray();

            var internNames = assignedInterns
                .Select(item => item.FullName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            return new
            {
                id = mission.Id,
                title = mission.Title,
                internId = internIds.FirstOrDefault(),
                internIds,
                internName = internNames.FirstOrDefault(),
                internNames,
                supervisorName = mission.Supervisor != null
                    ? $"{mission.Supervisor.FirstName} {mission.Supervisor.LastName}".Trim()
                    : (string?)null,
                status = mission.Status,
                deliverablesCount
            };
        });

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Crée une nouvelle mission.
    /// </summary>
    /// <remarks>
    /// Cette route permet de créer une mission avec un titre, une description, des compétences
    /// et des livrables attendus. Si un stagiaire est assigné, la mission devient \"active\"
    /// et le stagiaire reçoit une notification. Sinon, la mission est créée comme \"modèle\".
    /// </remarks>
    /// <param name="request">Objet contenant les informations de la mission.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la mission créée.</returns>
    /// <response code="201">Mission créée avec succès.</response>
    /// <response code="400">Données invalides ou stagiaire non trouvé.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpPost(Name = "CreateMission")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateMission([FromBody] CreateMissionRequest request, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        if (!TryResolveOptionalInternId(request.InternId, out var internId))
        {
            return BadRequest(new { message = "Invalid internId." });
        }

        if (!TryResolveOptionalInternIds(request.InternIds, out var internIds))
        {
            return BadRequest(new { message = "Invalid internIds." });
        }

        if (internId.HasValue)
        {
            internIds.Add(internId.Value);
        }

        internIds = internIds
            .Distinct()
            .ToList();

        if (internIds.Count > 0)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = "Direct intern assignment on mission creation is disabled. Create the mission as template and assign via POST /api/stages/assign."
            });
        }

        var skillValues = (request.Skills ?? Array.Empty<string>())
            .Where(skill => !string.IsNullOrWhiteSpace(skill))
            .Select(skill => skill.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var mission = new Mission
        {
            Id = Guid.NewGuid(),
            SupervisorId = supervisorId.Value,
            InternId = null,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            SkillsJson = JsonSerializer.Serialize(skillValues),
            Tools = request.Tools?.Trim() ?? string.Empty,
            Level = request.Level?.Trim() ?? string.Empty,
            Status = DomainStatuses.Mission.Template,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Missions.Add(mission);

        var deliverableTitles = (request.Deliverables ?? Array.Empty<string>())
            .Where(title => !string.IsNullOrWhiteSpace(title))
            .Select(title => title.Trim())
            .ToList();

        for (var index = 0; index < deliverableTitles.Count; index++)
        {
            var deliverable = new Deliverable
            {
                Id = Guid.NewGuid(),
                MissionId = mission.Id,
                SupervisorId = supervisorId.Value,
                InternId = null,
                Title = deliverableTitles[index],
                Status = DomainStatuses.Deliverable.Pending,
                FileUrl = string.Empty,
                Version = 1,
                Progress = 0,
                DueDate = DateTime.UtcNow.AddDays(7 * (index + 1)),
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Deliverables.Add(deliverable);
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "mission.create",
            Entity = $"mission:{mission.Id}",
            Timestamp = DateTime.UtcNow
        });

        dbContext.MissionHistoryEntries.Add(new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = mission.Id,
            Field = "created",
            OldValue = null,
            NewValue = mission.Status,
            ChangedByUserId = supervisorId,
            ChangedBy = UserContextHelper.ResolveCurrentActorName(User),
            ChangedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = new
        {
            id = mission.Id,
            title = mission.Title,
            status = mission.Status,
            internIds = Array.Empty<Guid>(),
            internNames = Array.Empty<string>()
        };

        return CreatedAtAction(nameof(GetMissionById), new { id = mission.Id }, result);
    }

    /// <summary>
    /// Récupère les détails d une mission spécifique.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les informations d une mission : titre, description,
    /// statut, stagiaire assigné, outils et niveau requis. Seul le créateur de la mission
    /// peut y accéder.
    /// </remarks>
    /// <param name="id">Identifiant unique de la mission.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les détails complets de la mission.</returns>
    /// <response code="200">Mission récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé (pas le propriétaire).</response>
    /// <response code="404">Mission non trouvée.</response>
    [HttpGet("{id:guid}", Name = "GetMissionById")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMissionById(Guid id, CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var mission = await dbContext.Missions
            .AsNoTracking()
            .Include(item => item.Intern)
            .Include(item => item.InternAssignments)
                .ThenInclude(assignment => assignment.Intern)
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == currentSupervisorId.Value, cancellationToken);

        if (mission is null)
        {
            return NotFound();
        }

        var assignedInterns = mission.InternAssignments
            .Select(assignment => new
            {
                assignment.InternId,
                FullName = assignment.Intern != null
                    ? $"{assignment.Intern.FirstName} {assignment.Intern.LastName}".Trim()
                    : string.Empty
            })
            .Where(item => item.InternId != Guid.Empty)
            .OrderBy(item => item.FullName)
            .ToList();

        if (assignedInterns.Count == 0 && mission.InternId.HasValue)
        {
            assignedInterns.Add(new
            {
                InternId = mission.InternId.Value,
                FullName = mission.Intern != null
                    ? $"{mission.Intern.FirstName} {mission.Intern.LastName}".Trim()
                    : string.Empty
            });
        }

        var internIds = assignedInterns
            .Select(item => item.InternId)
            .Distinct()
            .ToArray();

        var internNames = assignedInterns
            .Select(item => item.FullName)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return Ok(new
        {
            id = mission.Id,
            title = mission.Title,
            description = mission.Description,
            status = mission.Status,
            internId = internIds.Length > 0 ? internIds[0] : (Guid?)null,
            internIds,
            internName = internNames.FirstOrDefault() ?? string.Empty,
            internNames,
            tools = mission.Tools,
            level = mission.Level,
            createdAt = mission.CreatedAt
        });
    }

    /// <summary>
    /// Met à jour les informations d une mission.
    /// </summary>
    /// <remarks>
    /// Cette route permet de modifier le titre, la description, les compétences,
    /// les outils, le niveau ou le statut d une mission. Seuls les champs fournis
    /// sont mis à jour. Un historique des modifications est conservé.
    /// </remarks>
    /// <param name="id">Identifiant unique de la mission à modifier.</param>
    /// <param name="request">Objet contenant les champs à mettre à jour.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour de la mission.</returns>
    /// <response code="200">Mission mise à jour avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Mission non trouvée.</response>
    [HttpPatch("{id:guid}", Name = "UpdateMission")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMission(Guid id, [FromBody] UpdateMissionRequest request, CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var mission = await dbContext.Missions
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == currentSupervisorId.Value, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Mission not found." });
        }

        var historyEntries = new List<MissionHistoryEntry>();

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            var normalizedTitle = request.Title.Trim();
            if (!string.Equals(mission.Title, normalizedTitle, StringComparison.Ordinal))
            {
                historyEntries.Add(BuildHistoryEntry(mission.Id, "title", mission.Title, normalizedTitle, currentSupervisorId));
                mission.Title = normalizedTitle;
            }
        }

        if (request.Description is not null)
        {
            var normalizedDescription = request.Description.Trim();
            if (!string.Equals(mission.Description, normalizedDescription, StringComparison.Ordinal))
            {
                historyEntries.Add(BuildHistoryEntry(mission.Id, "description", mission.Description, normalizedDescription, currentSupervisorId));
                mission.Description = normalizedDescription;
            }
        }

        if (request.Skills is not null)
        {
            var normalizedSkills = request.Skills
                .Where(skill => !string.IsNullOrWhiteSpace(skill))
                .Select(skill => skill.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            var oldSkillsJson = mission.SkillsJson;
            var newSkillsJson = JsonSerializer.Serialize(normalizedSkills);

            if (!string.Equals(oldSkillsJson, newSkillsJson, StringComparison.Ordinal))
            {
                historyEntries.Add(BuildHistoryEntry(mission.Id, "skills", oldSkillsJson, newSkillsJson, currentSupervisorId));
                mission.SkillsJson = newSkillsJson;
            }
        }

        if (request.Tools is not null)
        {
            var normalizedTools = request.Tools.Trim();
            if (!string.Equals(mission.Tools, normalizedTools, StringComparison.Ordinal))
            {
                historyEntries.Add(BuildHistoryEntry(mission.Id, "tools", mission.Tools, normalizedTools, currentSupervisorId));
                mission.Tools = normalizedTools;
            }
        }

        if (request.Level is not null)
        {
            var normalizedLevel = request.Level.Trim();
            if (!string.Equals(mission.Level, normalizedLevel, StringComparison.Ordinal))
            {
                historyEntries.Add(BuildHistoryEntry(mission.Id, "level", mission.Level, normalizedLevel, currentSupervisorId));
                mission.Level = normalizedLevel;
            }
        }

        if (request.Status is not null)
        {
            var normalizedStatus = request.Status.Trim().ToLowerInvariant();
            if (!IsAllowedMissionStatus(normalizedStatus))
            {
                return BadRequest(new { message = "Invalid mission status." });
            }

            if (normalizedStatus == DomainStatuses.Mission.Active)
            {
                return StatusCode(StatusCodes.Status409Conflict, new
                {
                    message = "Mission activation is handled by POST /api/stages/assign to enforce lifecycle transitions."
                });
            }

            if (normalizedStatus == DomainStatuses.Mission.Completed)
            {
                var assignedInternIds = await ResolveMissionAssignedInternIdsAsync(mission.Id, cancellationToken);

                if (assignedInternIds.Count == 0 && mission.InternId.HasValue)
                {
                    assignedInternIds = [mission.InternId.Value];
                }

                var internStatuses = assignedInternIds.Count == 0
                    ? []
                    : await dbContext.Users
                    .AsNoTracking()
                    .Where(item => assignedInternIds.Contains(item.Id) && item.Role == UserRole.Intern)
                    .Select(item => new
                    {
                        item.Id,
                        item.VerificationStatus
                    })
                    .ToListAsync(cancellationToken);

                var hasInactiveIntern = assignedInternIds.Count > 0 &&
                    (internStatuses.Count != assignedInternIds.Count ||
                     internStatuses.Any(item => item.VerificationStatus != InternVerificationStatus.ACTIVE));

                if (hasInactiveIntern)
                {
                    return StatusCode(StatusCodes.Status409Conflict, new
                    {
                        message = "Only ACTIVE interns can transition to COMPLETED."
                    });
                }

                foreach (var assignedInternId in assignedInternIds)
                {
                    notificationService.QueueNotification(
                        assignedInternId,
                        "intern.status.completed",
                        "Internship completed",
                        "Congratulations. Your internship status is now COMPLETED.",
                        $"mission:{mission.Id}");
                }
            }

            if (!string.Equals(mission.Status, normalizedStatus, StringComparison.OrdinalIgnoreCase))
            {
                historyEntries.Add(BuildHistoryEntry(mission.Id, "status", mission.Status, normalizedStatus, currentSupervisorId));
                mission.Status = normalizedStatus;
            }
        }

        if (historyEntries.Count == 0)
        {
            var assignedInternIds = await ResolveMissionAssignedInternIdsAsync(mission.Id, cancellationToken);

            return Ok(new
            {
                id = mission.Id,
                title = mission.Title,
                status = mission.Status,
                internId = assignedInternIds.Count > 0 ? assignedInternIds[0] : (Guid?)null,
                internIds = assignedInternIds
            });
        }

        dbContext.MissionHistoryEntries.AddRange(historyEntries);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentSupervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "mission.update",
            Entity = $"mission:{mission.Id} fields:{string.Join(',', historyEntries.Select(item => item.Field))}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedInternIds = await ResolveMissionAssignedInternIdsAsync(mission.Id, cancellationToken);

        return Ok(new
        {
            id = mission.Id,
            title = mission.Title,
            status = mission.Status,
            internId = updatedInternIds.Count > 0 ? updatedInternIds[0] : (Guid?)null,
            internIds = updatedInternIds
        });
    }

/// <summary>
/// Récupère l historique des modifications d une mission.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les modifications apportées à une mission
    /// (titre, statut, assignation, etc.). Chaque entrée indique l ancienne valeur,
    /// la nouvelle valeur, l auteur et la date.
    /// </remarks>
    /// <param name="id">Identifiant unique de la mission.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée des modifications.</returns>
    /// <response code="200">Historique récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Mission non trouvée.</response>
    [HttpGet("{id:guid}/history", Name = "GetMissionHistory")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMissionHistory(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var exists = await dbContext.Missions
            .AsNoTracking()
            .AnyAsync(item => item.Id == id && item.SupervisorId == supervisorId.Value, cancellationToken);

        if (!exists)
        {
            return NotFound(new { message = "Mission not found." });
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.MissionHistoryEntries
            .AsNoTracking()
            .Where(item => item.MissionId == id);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderByDescending(item => item.ChangedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(item => new
            {
                id = item.Id,
                field = item.Field,
                oldValue = item.OldValue,
                newValue = item.NewValue,
                changedBy = item.ChangedBy,
                changedAt = item.ChangedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Supprime une mission.
    /// </summary>
    /// <remarks>
    /// Cette route supprime définitivement une mission et tous ses livrables associés.
    /// Les tâches liées aux livrables sont également supprimées.
    /// Cette action est irréversible.
    /// </remarks>
    /// <param name="id">Identifiant unique de la mission à supprimer.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Mission supprimée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Mission non trouvée.</response>
    [HttpDelete("{id:guid}", Name = "DeleteMission")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("delete-operations")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteMission(Guid id, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var mission = await dbContext.Missions
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == supervisorId.Value, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Mission not found." });
        }

        var deliverableIds = await dbContext.Deliverables
            .AsNoTracking()
            .Where(item => item.MissionId == mission.Id)
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);

        if (deliverableIds.Count > 0)
        {
            var tasks = await dbContext.InternTasks
                .Where(task => task.DeliverableId.HasValue && deliverableIds.Contains(task.DeliverableId.Value))
                .ToListAsync(cancellationToken);

            if (tasks.Count > 0)
            {
                dbContext.InternTasks.RemoveRange(tasks);
            }
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "mission.delete",
            Entity = $"mission:{mission.Id}",
            Timestamp = DateTime.UtcNow
        });

        dbContext.Missions.Remove(mission);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private MissionHistoryEntry BuildHistoryEntry(Guid missionId, string field, string? oldValue, string? newValue, Guid? actorUserId)
    {
        return new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = missionId,
            Field = field,
            OldValue = oldValue,
            NewValue = newValue,
            ChangedByUserId = actorUserId,
            ChangedBy = UserContextHelper.ResolveCurrentActorName(User),
            ChangedAt = DateTime.UtcNow
        };
    }

    private static bool IsAllowedMissionStatus(string status)
    {
        return status is
            DomainStatuses.Mission.Active or
            DomainStatuses.Mission.Template or
            DomainStatuses.Mission.Paused or
            DomainStatuses.Mission.Completed or
            DomainStatuses.Mission.Cancelled;
    }

    private static bool TryResolveOptionalInternId(string? rawInternId, out Guid? internId)
    {
        internId = null;

        if (string.IsNullOrWhiteSpace(rawInternId))
        {
            return true;
        }

        if (Guid.TryParse(rawInternId.Trim(), out var parsedInternId))
        {
            internId = parsedInternId;
            return true;
        }

        return false;
    }

    private static bool TryResolveOptionalInternIds(IEnumerable<string>? rawInternIds, out List<Guid> internIds)
    {
        internIds = [];

        if (rawInternIds is null)
        {
            return true;
        }

        foreach (var rawInternId in rawInternIds)
        {
            if (string.IsNullOrWhiteSpace(rawInternId))
            {
                continue;
            }

            if (!Guid.TryParse(rawInternId.Trim(), out var parsedInternId))
            {
                return false;
            }

            internIds.Add(parsedInternId);
        }

        return true;
    }

    private async Task<List<Guid>> ResolveMissionAssignedInternIdsAsync(Guid missionId, CancellationToken cancellationToken)
    {
        return await dbContext.MissionInternAssignments
            .AsNoTracking()
            .Where(item => item.MissionId == missionId)
            .Select(item => item.InternId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

}

public sealed class CreateMissionRequest
{
    public string Title { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;

    public string[] Skills { get; init; } = Array.Empty<string>();

    public string Tools { get; init; } = string.Empty;

    public string Level { get; init; } = string.Empty;

    public string[] Deliverables { get; init; } = Array.Empty<string>();

    public string InternId { get; init; } = string.Empty;

    public string[] InternIds { get; init; } = Array.Empty<string>();
}

public sealed class UpdateMissionRequest
{
    public string? Title { get; init; }

    public string? Description { get; init; }

    public string[]? Skills { get; init; }

    public string? Tools { get; init; }

    public string? Level { get; init; }

public string? Status { get; init; }
 }
