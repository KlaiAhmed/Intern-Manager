using System.Text.Json;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des missions du superviseur.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="notificationService">Service pour envoyer des notifications.</param>
[ApiController]
[Route("api/missions")]
[Authorize(Roles = "Supervisor")]
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
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyMissions(
        [FromQuery] string? supervisorId = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentSupervisorId.Value))
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var missionsQuery = dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.SupervisorId == currentSupervisorId.Value)
            .Include(mission => mission.Intern);

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

            return new
            {
                id = mission.Id,
                title = mission.Title,
                internName = mission.Intern != null
                    ? $"{mission.Intern.FirstName} {mission.Intern.LastName}".Trim()
                    : (string?)null,
                status = mission.Status,
                deliverableCount = deliverablesCount,
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
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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

        if (internId.HasValue)
        {
            var internExists = await dbContext.Users
                .AsNoTracking()
                .AnyAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

            if (!internExists)
            {
                return BadRequest(new { message = "Intern not found." });
            }

            var canAssignIntern = await CanAssignInternAsync(supervisorId.Value, internId.Value, cancellationToken);
            if (!canAssignIntern)
            {
                return Forbid();
            }
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
            InternId = internId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            SkillsJson = JsonSerializer.Serialize(skillValues),
            Tools = request.Tools?.Trim() ?? string.Empty,
            Level = request.Level?.Trim() ?? string.Empty,
            Status = internId.HasValue ? "active" : "template",
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
                InternId = internId,
                Title = deliverableTitles[index],
                Status = "pending",
                FileUrl = string.Empty,
                Version = 1,
                Progress = 0,
                DueDate = DateTime.UtcNow.AddDays(7 * (index + 1)),
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Deliverables.Add(deliverable);

            if (internId.HasValue)
            {
                dbContext.InternTasks.Add(new InternTask
                {
                    Id = Guid.NewGuid(),
                    InternId = internId.Value,
                    DeliverableId = deliverable.Id,
                    Title = deliverable.Title,
                    DueDate = deliverable.DueDate,
                    IsComplete = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
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

        if (internId.HasValue)
        {
            notificationService.QueueNotification(
                internId.Value,
                "mission.assigned",
                "New mission assigned",
                $"A mission titled '{mission.Title}' has been assigned to you.",
                $"mission:{mission.Id}");
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = new
        {
            id = mission.Id,
            title = mission.Title,
            status = mission.Status
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
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == currentSupervisorId.Value, cancellationToken);

        if (mission is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            id = mission.Id,
            title = mission.Title,
            description = mission.Description,
            status = mission.Status,
            internId = mission.InternId,
            internName = mission.Intern != null
                ? $"{mission.Intern.FirstName} {mission.Intern.LastName}".Trim()
                : string.Empty,
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

            if (!string.Equals(mission.Status, normalizedStatus, StringComparison.OrdinalIgnoreCase))
            {
                historyEntries.Add(BuildHistoryEntry(mission.Id, "status", mission.Status, normalizedStatus, currentSupervisorId));
                mission.Status = normalizedStatus;
            }
        }

        if (historyEntries.Count == 0)
        {
            return Ok(new
            {
                id = mission.Id,
                title = mission.Title,
                status = mission.Status,
                internId = mission.InternId
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

        return Ok(new
        {
            id = mission.Id,
            title = mission.Title,
            status = mission.Status,
            internId = mission.InternId
        });
    }

    /// <summary>
    /// Assigne ou désassigne un stagiaire à une mission.
    /// </summary>
    /// <remarks>
    /// Cette route permet d assigner un stagiaire à une mission existante.
    /// Si aucun stagiaire n est fourni, la mission redevient un \"modèle\".
    /// Les livrables et tâches associées sont automatiquement mis à jour.
    /// Le stagiaire reçoit une notification de l assignation.
    /// </remarks>
    /// <param name="id">Identifiant unique de la mission.</param>
    /// <param name="request">Objet contenant l identifiant du stagiaire (ou null).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour de la mission.</returns>
    /// <response code="200">Assignation réussie.</response>
    /// <response code="400">Stagiaire invalide.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Mission non trouvée.</response>
    [HttpPatch("{id:guid}/assign", Name = "AssignMissionIntern")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignMissionIntern(Guid id, [FromBody] AssignMissionRequest request, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (!TryResolveOptionalInternId(request.InternId, out var requestedInternId))
        {
            return BadRequest(new { message = "Invalid internId." });
        }

        var mission = await dbContext.Missions
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == supervisorId.Value, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Mission not found." });
        }

        if (requestedInternId.HasValue)
        {
            var internExists = await dbContext.Users
                .AsNoTracking()
                .AnyAsync(user => user.Id == requestedInternId.Value && user.Role == UserRole.Intern, cancellationToken);

            if (!internExists)
            {
                return BadRequest(new { message = "Intern not found." });
            }

            var canAssignIntern = await CanAssignInternAsync(supervisorId.Value, requestedInternId.Value, cancellationToken);
            if (!canAssignIntern)
            {
                return Forbid();
            }
        }

        if (mission.InternId == requestedInternId)
        {
            return Ok(new
            {
                id = mission.Id,
                internId = mission.InternId,
                status = mission.Status
            });
        }

        var oldInternId = mission.InternId;
        mission.InternId = requestedInternId;
        mission.Status = requestedInternId.HasValue ? "active" : "template";

        var deliverables = await dbContext.Deliverables
            .Where(item => item.MissionId == mission.Id)
            .ToListAsync(cancellationToken);

        foreach (var deliverable in deliverables)
        {
            deliverable.InternId = requestedInternId;
        }

        var deliverableIds = deliverables.Select(item => item.Id).ToList();
        if (deliverableIds.Count > 0)
        {
            var linkedTasks = await dbContext.InternTasks
                .Where(task => task.DeliverableId.HasValue && deliverableIds.Contains(task.DeliverableId.Value))
                .ToListAsync(cancellationToken);

            if (linkedTasks.Count > 0)
            {
                dbContext.InternTasks.RemoveRange(linkedTasks);
            }

            if (requestedInternId.HasValue)
            {
                foreach (var deliverable in deliverables)
                {
                    var isComplete = deliverable.Progress >= 100 ||
                                     deliverable.Status.Equals("accepted", StringComparison.OrdinalIgnoreCase);

                    dbContext.InternTasks.Add(new InternTask
                    {
                        Id = Guid.NewGuid(),
                        InternId = requestedInternId.Value,
                        DeliverableId = deliverable.Id,
                        Title = deliverable.Title,
                        DueDate = deliverable.DueDate,
                        IsComplete = isComplete,
                        CompletedAt = isComplete ? DateTime.UtcNow : null,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        dbContext.MissionHistoryEntries.Add(BuildHistoryEntry(
            mission.Id,
            "internId",
            oldInternId?.ToString(),
            requestedInternId?.ToString(),
            supervisorId));

        dbContext.MissionHistoryEntries.Add(BuildHistoryEntry(
            mission.Id,
            "status",
            oldInternId.HasValue ? "active" : "template",
            mission.Status,
            supervisorId));

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "mission.assign",
            Entity = $"mission:{mission.Id} intern:{requestedInternId}",
            Timestamp = DateTime.UtcNow
        });

        if (requestedInternId.HasValue)
        {
            notificationService.QueueNotification(
                requestedInternId.Value,
                "mission.assigned",
                "Mission assignment updated",
                $"Mission '{mission.Title}' is now assigned to you.",
                $"mission:{mission.Id}");
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = mission.Id,
            internId = mission.InternId,
            status = mission.Status
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
        return status is "active" or "template" or "paused" or "completed" or "cancelled";
    }

    private async Task<bool> CanAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken)
    {
        var relatedSupervisorIds = new HashSet<Guid>();

        relatedSupervisorIds.UnionWith(await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.InternId == internId)
            .Select(mission => mission.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        relatedSupervisorIds.UnionWith(await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.InternId == internId)
            .Select(deliverable => deliverable.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        relatedSupervisorIds.UnionWith(await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.InternId == internId)
            .Select(evaluation => evaluation.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        relatedSupervisorIds.UnionWith(await dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.InternId == internId)
            .Select(meeting => meeting.SupervisorId)
            .Distinct()
            .ToListAsync(cancellationToken));

        return relatedSupervisorIds.Count == 0 || relatedSupervisorIds.Contains(supervisorId);
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

public sealed class AssignMissionRequest
{
    public string? InternId { get; init; }
}
