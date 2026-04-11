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
/// Contrôleur de gestion des tâches.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="notificationService">Service pour envoyer des notifications.</param>
/// <param name="taskWorkflowService">Service métier pour la gestion du workflow des tâches.</param>
[ApiController]
[Route("api/tasks")]
[Authorize]
public sealed class TasksController(
    AppDbContext dbContext,
    INotificationService notificationService,
    ITaskWorkflowService taskWorkflowService) : ControllerBase
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
            .OrderBy(task => task.IsComplete)
            .ThenBy(task => task.DueDate)
            .ThenBy(task => task.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(task => new
            {
                id = task.Id,
                title = task.Title,
                dueDate = task.DueDate,
                isComplete = task.IsComplete,
                completed = task.IsComplete
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Synchronise les tâches avec les livrables.
    /// </summary>
    /// <remarks>
    /// Cette route crée automatiquement des tâches pour les livrables qui n en ont pas encore.
    /// Elle est utile après l assignation d un nouveau livrable par le superviseur.
    /// Les tâches existantes ne sont pas modifiées.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Un message indiquant le nombre de tâches créées.</returns>
    /// <response code="200">Synchronisation réussie.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpPost("/api/intern/me/tasks/sync", Name = "SyncMyTasks")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [ProducesResponseType(typeof(ActionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SyncTasksFromDeliverables(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var createdCount = await taskWorkflowService.EnsureTasksFromDeliverablesAsync(internId.Value, cancellationToken);
        if (createdCount == 0)
        {
            return Ok(new ActionResponse
            {
                Success = true,
                Message = "No tasks to synchronize."
            });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "task.sync",
            Entity = $"intern:{internId.Value} created:{createdCount}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ActionResponse
        {
            Success = true,
            Message = $"Created {createdCount} task(s)."
        });
    }

    /// <summary>
    /// Marque une tâche comme terminée.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de marquer une tâche comme terminée.
    /// Si la tâche est liée à un livrable, sa progression passe à 100%.
    /// </remarks>
    /// <param name="id">Identifiant unique de la tâche.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la tâche mise à jour.</returns>
    /// <response code="200">Tâche marquée comme terminée.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Tâche non trouvée.</response>
    [HttpPatch("{id:guid}/complete", Name = "CompleteTask")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CompleteTask(Guid id, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var task = await dbContext.InternTasks
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (task is null)
        {
            return NotFound(new { message = "Task not found." });
        }

        task.IsComplete = true;
        task.CompletedAt = DateTime.UtcNow;

        if (task.DeliverableId.HasValue)
        {
            var deliverable = await dbContext.Deliverables
                .FirstOrDefaultAsync(item => item.Id == task.DeliverableId.Value, cancellationToken);

            if (deliverable is not null)
            {
                deliverable.Progress = 100;
            }
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
            isComplete = true,
            completed = true
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
        if (request.DeliverableId.HasValue && request.DeliverableId.Value != Guid.Empty)
        {
            var deliverable = await dbContext.Deliverables
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == request.DeliverableId.Value && item.SupervisorId == supervisorId.Value, cancellationToken);

            if (deliverable is null)
            {
                return BadRequest(new { message = "Deliverable not found for current supervisor." });
            }

            if (deliverable.InternId.HasValue && deliverable.InternId.Value != request.InternId)
            {
                return BadRequest(new { message = "Deliverable is assigned to another intern." });
            }

            deliverableId = deliverable.Id;
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
            DueDate = normalizedDueDate,
            IsComplete = false,
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

        notificationService.QueueNotification(
            task.InternId,
            "task.assigned",
            "New task assigned",
            $"Task '{task.Title}' has been assigned to you.",
            $"task:{task.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Created($"/api/tasks/{task.Id}", new
        {
            id = task.Id,
            internId = task.InternId,
            title = task.Title,
            dueDate = task.DueDate,
            isComplete = task.IsComplete
        });
    }

}

public sealed class AssignTaskRequest
{
    public Guid InternId { get; init; }

    public Guid? DeliverableId { get; init; }

    public string Title { get; init; } = string.Empty;

    public DateTime? DueDate { get; init; }
}
