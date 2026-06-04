using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Attributes;
using InternManager.Api.Common.Exceptions;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des tâches.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="notificationService">Service pour envoyer des notifications.</param>
/// <param name="taskWorkflowService">Service métier pour la gestion du workflow des tâches.</param>
/// <param name="taskStateService">Service métier pour faire évoluer l'état des tâches.</param>
/// <param name="deliverableStateService">Service métier pour faire évoluer l'état des livrables.</param>
/// <param name="missionPolicyService">Service métier pour valider les règles de mission.</param>
[ApiController]
[Route("api/tasks")]
[Authorize]
public sealed class TasksController(
    AppDbContext dbContext,
    INotificationService notificationService,
    ITaskWorkflowService taskWorkflowService,
    ITaskStateService taskStateService,
    IDeliverableStateService deliverableStateService,
    IMissionPolicyService missionPolicyService,
    IDeliverableProgressService deliverableProgressService) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des tâches du stagiaire connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les tâches assignées au stagiaire.
    /// Les tâches sont triées par statut (non terminées d abord) puis par date limite.
    /// Chaque tâche peut être liée à un livrable.
    /// </remarks>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée de tâches.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="400">Erreur de validation.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("/api/intern/me/tasks", Name = "ListMyTasks")]
    [FeatureCard(DashboardCard.Tasks)]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyTasks(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        if (!isAdminScope)
        {
            var isIntern = await dbContext.Users
                .AsNoTracking()
                .AnyAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

            if (!isIntern)
            {
                return Forbid();
            }
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.InternTasks
            .AsNoTracking()
            .Where(task => task.InternId == internId.Value);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderBy(task => task.Status == DomainStatuses.Task.Done)
            .ThenBy(task => task.DueDate)
            .ThenBy(task => task.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(task => new
            {
                id = task.Id,
                title = task.Title,
                dueDate = task.DueDate,
                status = task.Status,
                rowVersion = task.RowVersion
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    // REMOVED: legacy task-from-deliverable sync (Phase 1 - 1:1 anti-pattern eliminated)

    /// <summary>
    /// Marque une tâche comme terminée.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de marquer une tâche comme terminée.
    /// Si la tâche est liée à un livrable, sa progression passe à 100%.
    /// </remarks>
    /// <param name="id">Identifiant unique de la tâche.</param>
    /// <param name="request">Corps de la requête contenant le numéro de version attendu.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la tâche mise à jour.</returns>
    /// <response code="200">Tâche marquée comme terminée.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Tâche non trouvée.</response>
    [HttpPatch("{id:guid}/complete", Name = "CompleteTask")]
    [FeatureCard(DashboardCard.Tasks)]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CompleteTask(Guid id, [FromBody] CompleteTaskRequest request, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var task = await dbContext.InternTasks
            .Include(item => item.Deliverable)
                .ThenInclude(deliverable => deliverable!.Mission)
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (task is null)
        {
            return NotFound(new { message = "Task not found." });
        }

        if (string.Equals(task.Status, DomainStatuses.Task.Done, StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await taskStateService.RevertToTodoAsync(
                    task.Id,
                    internId.Value,
                    request.RowVersion,
                    dbContext);
            }
            catch (ConcurrencyException)
            {
                return Conflict(new { message = "The task was modified concurrently. Please refresh and try again." });
            }

            dbContext.AuditLogs.Add(new AuditLog
            {
                ActorUserId = internId,
                Actor = UserContextHelper.ResolveCurrentActorName(User),
                Action = "task.reverted",
                Entity = $"task:{task.Id}",
                Timestamp = DateTime.UtcNow
            });

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                id = task.Id,
                status = task.Status
            });
        }

        await missionPolicyService.CanMarkTaskDoneAsync(
            internId.Value,
            UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
            task.Id);

        if (task.Deliverable?.MissionId is Guid missionId)
        {
            await missionPolicyService.AssertMissionNotArchivedAsync(missionId);
        }

        try
        {
            await taskStateService.MarkDoneAsync(
                task.Id,
                internId.Value,
                request.RowVersion,
                isSupervisorOverride: false,
                dbContext);
        }
        catch (ConcurrencyException)
        {
            return Conflict(new { message = "The task was modified concurrently. Please refresh and try again." });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.complete",
            Entity = $"task:{task.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = task.Id,
            status = task.Status
        });
    }

    /// <summary>
    /// Assigne une nouvelle tâche à un stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de créer une tâche pour un stagiaire.
    /// La tâche peut être liée à un livrable existant ou être indépendante.
    /// Le stagiaire reçoit une notification lors de l assignation.
    /// </remarks>
    /// <param name="request">Objet contenant les informations de la tâche (stagiaire, titre, date limite).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la tâche créée.</returns>
    /// <response code="201">Tâche assignée avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpPost(Name = "AssignTask")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AssignTask([FromBody] AssignTaskRequest request, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (request.InternId == Guid.Empty)
        {
            return BadRequest(new { message = "internId is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "title is required." });
        }

        var internExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == request.InternId && user.Role == UserRole.Intern, cancellationToken);

        if (!internExists)
        {
            return BadRequest(new { message = "Intern not found." });
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        if (!isAdminScope)
        {
            var canAssign = await taskWorkflowService.CanSupervisorAssignInternAsync(supervisorId.Value, request.InternId, cancellationToken);
            if (!canAssign)
            {
                return Forbid();
            }
        }

        Guid? deliverableId = null;
        Guid? missionId = null;
        Deliverable? deliverable = null;
        if (request.DeliverableId.HasValue && request.DeliverableId.Value != Guid.Empty)
        {
            deliverable = await dbContext.Deliverables
                .AsNoTracking()
                .Include(item => item.Mission)
                .FirstOrDefaultAsync(item => item.Id == request.DeliverableId.Value, cancellationToken);

            if (deliverable is null)
            {
                return BadRequest(new { message = "Deliverable not found for current supervisor." });
            }

            if (deliverable.InternId.HasValue && deliverable.InternId.Value != request.InternId)
            {
                return BadRequest(new { message = "Deliverable is assigned to another intern." });
            }

            deliverableId = deliverable.Id;
            missionId = deliverable.MissionId;
        }
        else if (!isAdminScope)
        {
            var mission = await dbContext.Missions
                .AsNoTracking()
                .FirstOrDefaultAsync(item =>
                    (item.SupervisorId == supervisorId.Value || item.CoSupervisorId == supervisorId.Value) &&
                    item.InternId == request.InternId,
                    cancellationToken);

            if (mission is null)
            {
                return BadRequest(new { message = "Mission not found for current supervisor." });
            }

            missionId = mission.Id;
        }

        if (missionId.HasValue)
        {
            await missionPolicyService.CanCreateTaskAsync(
                supervisorId.Value,
                UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
                missionId.Value);

            await missionPolicyService.AssertMissionNotArchivedAsync(missionId.Value);
        }

        var normalizedDueDate = request.DueDate.HasValue
            ? (request.DueDate.Value.Kind == DateTimeKind.Utc
                ? request.DueDate.Value
                : request.DueDate.Value.ToUniversalTime())
            : (DateTime?)null;

        var task = new InternTask
        {
            Id = Guid.NewGuid(),
            InternId = request.InternId,
            DeliverableId = deliverableId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            DueDate = normalizedDueDate,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.InternTasks.Add(task);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.assign",
            Entity = $"task:{task.Id} intern:{task.InternId}",
            Timestamp = DateTime.UtcNow
        });

        dbContext.EntityHistoryEntries.Add(new EntityHistoryEntry
        {
            Id = Guid.NewGuid(),
            EntityType = "Task",
            EntityId = task.Id,
            Action = "task.assigned",
            ActorId = supervisorId.Value,
            CreatedAt = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            task.InternId,
            "task.assigned",
            "New task assigned",
            $"Task '{task.Title}' has been assigned to you.",
            task.Id.ToString());

        if (task.DeliverableId.HasValue && deliverable is not null)
        {
            if (deliverable.Status == DomainStatuses.Deliverable.Draft)
            {
                await deliverableStateService.OnFirstTaskCreatedAsync(task.DeliverableId.Value, dbContext);
            }
            else if (deliverable.Status == DomainStatuses.Deliverable.AwaitingReview)
            {
                await deliverableStateService.OnTaskAddedWhileInReviewAsync(task.DeliverableId.Value, dbContext);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Created($"/api/tasks/{task.Id}", new
        {
            id = task.Id,
            internId = task.InternId,
            title = task.Title,
            dueDate = task.DueDate,
            status = task.Status
        });
    }

    /// <summary>
    /// Récupère toutes les tâches de tous les stagiaires associés à une mission.
    /// </summary>
    /// <remarks>
    /// Cette route consolide en une seule requête le fan-out client qui récupérait
    /// d abord la liste des stagiaires via <c>GET /api/supervisor/me/interns</c>
    /// puis appelait <c>GET /api/tasks/by-intern/{internId}</c> en parallèle pour
    /// chaque stagiaire. Elle retourne un tableau plat des tâches de la mission,
    /// indexable côté client par <c>internId</c>.
    /// L autorisation est limitée au superviseur propriétaire de la mission (les
    /// rôles <c>Admin</c> et <c>SuperAdmin</c> conservent un accès transverse).
    /// Le tri est effectué côté serveur : tâches avec <c>dueDate</c> d abord
    /// (croissant), tâches sans échéance en dernier.
    /// </remarks>
    /// <param name="missionId">Identifiant unique de la mission.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste plate des tâches de la mission, ordonnées par échéance.</returns>
    /// <response code="200">Tâches récupérées avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">L utilisateur n est pas le superviseur de cette mission.</response>
    /// <response code="404">Mission introuvable.</response>
    [HttpGet("by-mission/{missionId:guid}", Name = "ListTasksByMission")]
    [FeatureCard(DashboardCard.Tasks)]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(typeof(IEnumerable<InternTaskResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTasksByMission(Guid missionId, CancellationToken cancellationToken = default)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");

        var mission = await dbContext.Missions
            .AsNoTracking()
            .Select(item => new { item.Id, item.SupervisorId })
            .FirstOrDefaultAsync(item => item.Id == missionId, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Mission not found." });
        }

        if (!isAdminScope && mission.SupervisorId != supervisorId.Value)
        {
            return Forbid();
        }

        // Collect every intern associated with the mission through either the
        // direct (legacy) `Mission.InternId` link or the multi-intern
        // `MissionInternAssignments` table. The two sources are unioned so a
        // single SQL round-trip replaces the previous per-intern fan-out.
        var associatedInternIds = dbContext.MissionInternAssignments
            .AsNoTracking()
            .Where(assignment => assignment.MissionId == missionId)
            .Select(assignment => assignment.InternId)
            .Union(
                dbContext.Missions
                    .AsNoTracking()
                    .Where(m => m.Id == missionId && m.InternId.HasValue)
                    .Select(m => m.InternId!.Value));

        var data = await dbContext.InternTasks
            .AsNoTracking()
            .Where(task => associatedInternIds.Contains(task.InternId))
            // Tasks with a due date first (ascending), undated tasks last.
            .OrderBy(task => task.DueDate.HasValue ? 0 : 1)
            .ThenBy(task => task.DueDate)
            .ThenBy(task => task.CreatedAt)
            .Select(task => new InternTaskResponse
            {
                Id = task.Id,
                InternId = task.InternId,
                DeliverableId = task.DeliverableId,
                Title = task.Title,
                Description = task.Description,
                Status = task.Status,
                RowVersion = task.RowVersion,
                DueDate = task.DueDate,
                CompletedAt = task.CompletedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(data);
    }

    /// <summary>
    /// Updates the editable metadata of a task owned by a mission the supervisor can review.
    /// </summary>
    /// <remarks>
    /// Allows supervisors to patch the <c>Title</c>, <c>Description</c>, <c>DueDate</c>, and
    /// <c>DeliverableId</c> of a task linked to their mission. The supervisor must own
    /// the parent mission. Archives are rejected via the shared mission policy.
    /// </remarks>
    /// <param name="id">Unique identifier of the task to update.</param>
    /// <param name="request">Patch payload with optional title/description/due date/deliverable.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    /// <response code="200">Task updated successfully.</response>
    /// <response code="400">Title provided is empty after trimming.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">Task does not belong to a mission the supervisor owns.</response>
    /// <response code="404">Task not found.</response>
    [HttpPatch("{id:guid}", Name = "UpdateTask")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(InternTaskResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateTask(
        Guid id,
        [FromBody] UpdateTaskRequest request,
        CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (request is null)
        {
            return BadRequest(new { message = "Request body is required." });
        }

        var task = await dbContext.InternTasks
            .Include(item => item.Deliverable)
                .ThenInclude(deliverable => deliverable!.Mission)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (task is null)
        {
            return NotFound(new { message = "Task not found." });
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        if (!isAdminScope)
        {
            if (task.Deliverable?.Mission is null ||
                task.Deliverable.Mission.SupervisorId != supervisorId.Value)
            {
                return Forbid();
            }
        }

        if (task.Deliverable?.Mission is not null)
        {
            await missionPolicyService.AssertMissionNotArchivedAsync(task.Deliverable.MissionId);
        }

        var hasChanges = false;

        if (request.Title is not null)
        {
            var normalizedTitle = request.Title.Trim();
            if (normalizedTitle.Length == 0)
            {
                return BadRequest(new { message = "title is required." });
            }

            if (!string.Equals(task.Title, normalizedTitle, StringComparison.Ordinal))
            {
                task.Title = normalizedTitle;
                hasChanges = true;
            }
        }

        if (request.Description is not null)
        {
            var normalizedDescription = request.Description?.Trim();
            if (!string.Equals(task.Description, normalizedDescription, StringComparison.Ordinal))
            {
                task.Description = normalizedDescription;
                hasChanges = true;
            }
        }

        if (request.DueDate.HasValue)
        {
            var normalizedDueDate = request.DueDate.Value.Kind == DateTimeKind.Utc
                ? request.DueDate.Value
                : request.DueDate.Value.ToUniversalTime();

            if (task.DueDate != normalizedDueDate)
            {
                task.DueDate = normalizedDueDate;
                hasChanges = true;
            }
        }

        if (request.DeliverableId is not null)
        {
            var newDeliverableId = request.DeliverableId.Value;
            if (newDeliverableId == Guid.Empty)
            {
                if (task.DeliverableId.HasValue)
                {
                    task.DeliverableId = null;
                    hasChanges = true;
                }
            }
            else
            {
                if (task.DeliverableId != newDeliverableId)
                {
                    var deliverable = await dbContext.Deliverables
                        .AsNoTracking()
                        .Include(item => item.Mission)
                        .FirstOrDefaultAsync(item => item.Id == newDeliverableId, cancellationToken);

                    if (deliverable is null)
                    {
                        return BadRequest(new { message = "Deliverable not found." });
                    }

                    if (!isAdminScope && deliverable.Mission is not null &&
                        deliverable.Mission.SupervisorId != supervisorId.Value)
                    {
                        return Forbid();
                    }

                    if (deliverable.InternId.HasValue && deliverable.InternId.Value != task.InternId)
                    {
                        return BadRequest(new { message = "Deliverable is assigned to another intern." });
                    }

                    task.DeliverableId = newDeliverableId;
                    hasChanges = true;
                }
            }
        }

        if (!hasChanges)
        {
            return Ok(new InternTaskResponse
            {
                Id = task.Id,
                InternId = task.InternId,
                DeliverableId = task.DeliverableId,
                Title = task.Title,
                Description = task.Description,
                Status = task.Status,
                RowVersion = task.RowVersion,
                DueDate = task.DueDate,
                CompletedAt = task.CompletedAt
            });
        }

        task.StatusChangedAt = DateTime.UtcNow;
        task.RowVersion += 1;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.update",
            Entity = $"task:{task.Id}",
            Timestamp = DateTime.UtcNow
        });

        if (task.DeliverableId.HasValue)
        {
            await deliverableProgressService.RecalculateAsync(task.DeliverableId.Value, dbContext);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new InternTaskResponse
        {
            Id = task.Id,
            InternId = task.InternId,
            DeliverableId = task.DeliverableId,
            Title = task.Title,
            Description = task.Description,
            Status = task.Status,
            RowVersion = task.RowVersion,
            DueDate = task.DueDate,
            CompletedAt = task.CompletedAt
        });
    }

    /// <summary>
    /// Deletes a task owned by a mission the supervisor can review.
    /// </summary>
    /// <remarks>
    /// The supervisor must own the parent mission. Archives are rejected via the shared mission policy.
    /// Recalculates the linked deliverable's progress on success.
    /// </remarks>
    /// <param name="id">Unique identifier of the task to delete.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    /// <response code="204">Task deleted successfully.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">Task does not belong to a mission the supervisor owns.</response>
    /// <response code="404">Task not found.</response>
    [HttpDelete("{id:guid}", Name = "DeleteTask")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("delete-operations")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTask(Guid id, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var task = await dbContext.InternTasks
            .Include(item => item.Deliverable)
                .ThenInclude(deliverable => deliverable!.Mission)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (task is null)
        {
            return NotFound(new { message = "Task not found." });
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        if (!isAdminScope)
        {
            if (task.Deliverable?.Mission is null ||
                task.Deliverable.Mission.SupervisorId != supervisorId.Value)
            {
                return Forbid();
            }
        }

        if (task.Deliverable?.Mission is not null)
        {
            await missionPolicyService.AssertMissionNotArchivedAsync(task.Deliverable.MissionId);
        }

        var linkedDeliverableId = task.DeliverableId;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.delete",
            Entity = $"task:{task.Id}",
            Timestamp = DateTime.UtcNow
        });

        dbContext.EntityHistoryEntries.Add(new EntityHistoryEntry
        {
            Id = Guid.NewGuid(),
            EntityType = "Task",
            EntityId = task.Id,
            Action = "task.deleted",
            ActorId = supervisorId.Value,
            CreatedAt = DateTime.UtcNow
        });

        dbContext.InternTasks.Remove(task);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (linkedDeliverableId.HasValue)
        {
            await deliverableProgressService.RecalculateAsync(linkedDeliverableId.Value, dbContext);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return NoContent();
    }

    /// <summary>
    /// Supervisor-side status transition endpoint for a task owned by their mission.
    /// </summary>
    /// <remarks>
    /// Validates the requested status against the allowed task status set, then delegates
    /// to the underlying <see cref="ITaskStateService"/> so concurrency and side effects
    /// (audit log, deliverable progress, notifications) match the intern flow.
    /// </remarks>
    /// <param name="id">Unique identifier of the task.</param>
    /// <param name="request">Status update payload with the expected <c>RowVersion</c>.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    /// <response code="200">Status updated successfully.</response>
    /// <response code="400">Status value is not recognized.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">Task does not belong to a mission the supervisor owns.</response>
    /// <response code="404">Task not found.</response>
    /// <response code="409">Row version mismatch.</response>
    [HttpPut("{id:guid}/status", Name = "UpdateTaskStatus")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(InternTaskResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateTaskStatus(
        Guid id,
        [FromBody] UpdateTaskStatusRequest request,
        CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (request is null || string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest(new { message = "status is required." });
        }

        var normalizedStatus = request.Status.Trim().ToLowerInvariant();
        if (!IsAllowedTaskStatus(normalizedStatus))
        {
            return BadRequest(new { message = $"Unsupported status '{request.Status}'." });
        }

        var task = await dbContext.InternTasks
            .Include(item => item.Deliverable)
                .ThenInclude(deliverable => deliverable!.Mission)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (task is null)
        {
            return NotFound(new { message = "Task not found." });
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        if (!isAdminScope)
        {
            if (task.Deliverable?.Mission is null ||
                task.Deliverable.Mission.SupervisorId != supervisorId.Value)
            {
                return Forbid();
            }
        }

        if (task.Deliverable?.Mission is not null)
        {
            await missionPolicyService.AssertMissionNotArchivedAsync(task.Deliverable.MissionId);
        }

        try
        {
            switch (normalizedStatus)
            {
                case DomainStatuses.Task.Done:
                    await taskStateService.MarkDoneAsync(
                        task.Id,
                        supervisorId.Value,
                        request.RowVersion,
                        isSupervisorOverride: true,
                        dbContext);
                    break;

                case DomainStatuses.Task.Todo:
                    await taskStateService.RevertToTodoAsync(
                        task.Id,
                        supervisorId.Value,
                        request.RowVersion,
                        dbContext);
                    break;

                case DomainStatuses.Task.Reopened:
                    await taskStateService.ReopenAsync(
                        task.Id,
                        supervisorId.Value,
                        request.RowVersion,
                        "Reopened by supervisor",
                        dbContext);
                    break;

                case DomainStatuses.Task.InProgress:
                case DomainStatuses.Task.Cancelled:
                    var now = DateTime.UtcNow;
                    task.Status = normalizedStatus;
                    task.StatusChangedAt = now;
                    if (normalizedStatus == DomainStatuses.Task.Done)
                    {
                        task.CompletedAt = now;
                    }
                    else if (normalizedStatus == DomainStatuses.Task.Todo)
                    {
                        task.CompletedAt = null;
                    }
                    task.RowVersion += 1;

                    if (task.DeliverableId.HasValue)
                    {
                        await deliverableProgressService.RecalculateAsync(task.DeliverableId.Value, dbContext);
                    }
                    break;
            }
        }
        catch (ConcurrencyException)
        {
            return Conflict(new
            {
                error = "conflict",
                message = "This record was modified by another request. Please refresh and try again."
            });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = $"task.status.{normalizedStatus}",
            Entity = $"task:{task.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new InternTaskResponse
        {
            Id = task.Id,
            InternId = task.InternId,
            DeliverableId = task.DeliverableId,
            Title = task.Title,
            Description = task.Description,
            Status = task.Status,
            RowVersion = task.RowVersion,
            DueDate = task.DueDate,
            CompletedAt = task.CompletedAt
        });
    }

    private static bool IsAllowedTaskStatus(string status)
    {
        return status is
            DomainStatuses.Task.Todo or
            DomainStatuses.Task.InProgress or
            DomainStatuses.Task.Done or
            DomainStatuses.Task.Reopened or
            DomainStatuses.Task.Cancelled;
    }

}

public sealed class CompleteTaskRequest
{
    public int RowVersion { get; init; }
}

public sealed class AssignTaskRequest
{
    public Guid InternId { get; init; }

    public Guid? DeliverableId { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Description { get; init; }

    public DateTime? DueDate { get; init; }
}
