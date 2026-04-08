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
/// Contrôleur de gestion des réunions.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="notificationService">Service pour envoyer des notifications.</param>
[ApiController]
[Route("api/meetings")]
[Authorize(Roles = "Supervisor,Intern")]
[EnableRateLimiting("write-operations")]
public sealed class MeetingsController(
    AppDbContext dbContext,
    INotificationService notificationService,
    ISupervisorScopeService supervisorScopeService) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des réunions.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les réunions selon le rôle de l utilisateur.
    /// Les superviseurs voient toutes leurs réunions avec les stagiaires.
    /// Les stagiaires voient uniquement leurs réunions planifiées.
    /// Vous pouvez filtrer pour n afficher que les réunions à venir.
    /// </remarks>
    /// <param name="supervisorId">Optionnel : filtre par identifiant de superviseur.</param>
    /// <param name="internId">Optionnel : filtre par identifiant de stagiaire.</param>
    /// <param name="upcoming">Si vrai, retourne uniquement les réunions futures.</param>
    /// <param name="count">Si vrai, retourne uniquement le nombre de réunions correspondant au filtre.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste de réunions.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListMeetings")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMeetings(
        [FromQuery] string? supervisorId = null,
        [FromQuery] string? internId = null,
        [FromQuery] bool upcoming = false,
        [FromQuery] bool count = false,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        if (User.IsInRole("Intern"))
        {
            if (!UserContextHelper.IsCurrentInternScope(internId, currentUserId.Value))
            {
                return Forbid();
            }

            var internQuery = dbContext.Meetings
                .AsNoTracking()
                .Where(meeting => meeting.InternId == currentUserId.Value)
                .Where(meeting => !upcoming || meeting.Date >= DateTime.UtcNow);

            var internTotal = await internQuery.CountAsync(cancellationToken);

            if (count)
            {
                return Ok(new { count = internTotal });
            }

            var internData = await (upcoming
                    ? internQuery.OrderBy(meeting => meeting.Date)
                    : internQuery.OrderByDescending(meeting => meeting.Date))
                .Skip((safePage - 1) * safeLimit)
                .Take(safeLimit)
                .Select(meeting => new
                {
                    id = meeting.Id,
                    date = meeting.Date,
                    supervisorName = meeting.Supervisor != null
                        ? $"{meeting.Supervisor.FirstName} {meeting.Supervisor.LastName}".Trim()
                        : string.Empty,
                    notes = meeting.Notes
                })
                .ToListAsync(cancellationToken);

            return Ok(new { data = internData, total = internTotal, page = safePage, limit = safeLimit });
        }

        if (!User.IsInRole("Supervisor"))
        {
            return Forbid();
        }

        if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentUserId.Value))
        {
            return Forbid();
        }

        var query = dbContext.Meetings
            .AsNoTracking()
            .Where(meeting => meeting.SupervisorId == currentUserId.Value)
            .Where(meeting => !upcoming || meeting.Date >= DateTime.UtcNow)
            .Include(meeting => meeting.Intern);

        var total = await query.CountAsync(cancellationToken);

        if (count)
        {
            return Ok(new { count = total });
        }

        var data = await (upcoming
                ? query.OrderBy(meeting => meeting.Date)
                : query.OrderByDescending(meeting => meeting.Date))
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(meeting => new
            {
                id = meeting.Id,
                internId = meeting.InternId,
                internName = meeting.Intern != null
                    ? $"{meeting.Intern.FirstName} {meeting.Intern.LastName}".Trim()
                    : string.Empty,
                date = meeting.Date,
                notes = meeting.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Planifie une nouvelle réunion.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de planifier une réunion avec un stagiaire.
    /// La date doit être dans le futur. Il est impossible de créer une réunion
    /// si une autre réunion existe déjà dans un créneau de 1 heure.
    /// Le stagiaire reçoit une notification de la nouvelle réunion.
    /// </remarks>
    /// <param name="request">Objet contenant les informations de la réunion (stagiaire, date, notes).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de la réunion créée.</returns>
    /// <response code="201">Réunion créée avec succès.</response>
    /// <response code="400">Données invalides ou date dans le passé.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="409">Conflit avec une réunion existante.</response>
    [HttpPost(Name = "CreateMeeting")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateMeeting([FromBody] CreateMeetingRequest request, CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        if (request.InternId == Guid.Empty)
        {
            return BadRequest(new { message = "internId is required." });
        }

        if (request.Date == default)
        {
            return BadRequest(new { message = "date is required." });
        }

        var scheduledDate = request.Date.Kind == DateTimeKind.Utc
            ? request.Date
            : request.Date.ToUniversalTime();

        if (scheduledDate <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Meeting date must be in the future." });
        }

        var internExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == request.InternId && user.Role == UserRole.Intern, cancellationToken);

        if (!internExists)
        {
            return BadRequest(new { message = "Intern not found." });
        }

        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (!assignedInternIds.Contains(request.InternId))
        {
            return Forbid();
        }

        var conflictWindowStart = scheduledDate.AddMinutes(-59);
        var conflictWindowEnd = scheduledDate.AddMinutes(59);
        var hasConflict = await dbContext.Meetings
            .AsNoTracking()
            .AnyAsync(meeting => meeting.SupervisorId == currentSupervisorId.Value &&
                                 meeting.Date >= conflictWindowStart &&
                                 meeting.Date <= conflictWindowEnd,
                      cancellationToken);

        if (hasConflict)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Meeting slot conflicts with an existing meeting." });
        }

        var notes = request.Notes?.Trim() ?? string.Empty;
        if (notes.Length > 3000)
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["notes"] = "Notes cannot exceed 3000 characters."
            });
        }

        var meeting = new Meeting
        {
            Id = Guid.NewGuid(),
            SupervisorId = currentSupervisorId.Value,
            InternId = request.InternId,
            Date = scheduledDate,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Meetings.Add(meeting);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentSupervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "meeting.create",
            Entity = $"meeting:{meeting.Id}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            meeting.InternId,
            "meeting.reminder",
            "New meeting scheduled",
            $"A meeting has been scheduled for {meeting.Date:u}.",
            $"meeting:{meeting.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = new
        {
            id = meeting.Id,
            date = meeting.Date
        };

        return CreatedAtAction(nameof(GetMeetingById), new { id = meeting.Id }, result);
    }

    /// <summary>
    /// Récupère les détails d une réunion.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les informations d une réunion : date, notes,
    /// nom du stagiaire et du superviseur. Seuls les participants peuvent y accéder.
    /// </remarks>
    /// <param name="id">Identifiant unique de la réunion.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les détails de la réunion.</returns>
    /// <response code="200">Réunion récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Réunion non trouvée.</response>
    [HttpGet("{id:guid}", Name = "GetMeetingById")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMeetingById(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var meeting = await dbContext.Meetings
            .AsNoTracking()
            .Include(item => item.Intern)
            .Include(item => item.Supervisor)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (meeting is null)
        {
            return NotFound();
        }

        if (User.IsInRole("Intern") && meeting.InternId != currentUserId.Value)
        {
            return Forbid();
        }

        if (User.IsInRole("Supervisor") && meeting.SupervisorId != currentUserId.Value)
        {
            return Forbid();
        }

        return Ok(new
        {
            id = meeting.Id,
            date = meeting.Date,
            notes = meeting.Notes,
            internId = meeting.InternId,
            internName = meeting.Intern != null
                ? $"{meeting.Intern.FirstName} {meeting.Intern.LastName}".Trim()
                : string.Empty,
            supervisorId = meeting.SupervisorId,
            supervisorName = meeting.Supervisor != null
                ? $"{meeting.Supervisor.FirstName} {meeting.Supervisor.LastName}".Trim()
                : string.Empty
        });
    }

    /// <summary>
    /// Met à jour les informations d une réunion.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de modifier la date ou les notes d une réunion.
    /// La nouvelle date doit être dans le futur. Si la date est modifiée,
    /// le système vérifie qu il n y a pas de conflit avec d autres réunions.
    /// Le stagiaire reçoit une notification de la modification.
    /// </remarks>
    /// <param name="id">Identifiant unique de la réunion à modifier.</param>
    /// <param name="request">Objet contenant les champs à mettre à jour.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour de la réunion.</returns>
    /// <response code="200">Réunion mise à jour avec succès.</response>
    /// <response code="400">Nouvelle date dans le passé.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Réunion non trouvée.</response>
    /// <response code="409">Conflit avec une autre réunion.</response>
    [HttpPatch("{id:guid}", Name = "UpdateMeeting")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateMeeting(Guid id, [FromBody] UpdateMeetingRequest request, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var meeting = await dbContext.Meetings
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == supervisorId.Value, cancellationToken);

        if (meeting is null)
        {
            return NotFound(new { message = "Meeting not found." });
        }

        var hasChanges = false;

        if (request.Date.HasValue)
        {
            var normalizedDate = request.Date.Value.Kind == DateTimeKind.Utc
                ? request.Date.Value
                : request.Date.Value.ToUniversalTime();

            if (normalizedDate <= DateTime.UtcNow)
            {
                return BadRequest(new { message = "Meeting date must be in the future." });
            }

            if (meeting.Date != normalizedDate)
            {
                var conflictWindowStart = normalizedDate.AddMinutes(-59);
                var conflictWindowEnd = normalizedDate.AddMinutes(59);
                var hasConflict = await dbContext.Meetings
                    .AsNoTracking()
                    .AnyAsync(item => item.Id != meeting.Id &&
                                      item.SupervisorId == supervisorId.Value &&
                                      item.Date >= conflictWindowStart &&
                                      item.Date <= conflictWindowEnd,
                              cancellationToken);

                if (hasConflict)
                {
                    return StatusCode(StatusCodes.Status409Conflict, new { message = "Meeting slot conflicts with an existing meeting." });
                }

                meeting.Date = normalizedDate;
                hasChanges = true;
            }
        }

        if (request.Notes is not null)
        {
            var normalizedNotes = request.Notes?.Trim() ?? string.Empty;
            if (normalizedNotes.Length > 3000)
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["notes"] = "Notes cannot exceed 3000 characters."
                });
            }

            if (!string.Equals(meeting.Notes, normalizedNotes, StringComparison.Ordinal))
            {
                meeting.Notes = normalizedNotes;
                hasChanges = true;
            }
        }

        if (!hasChanges)
        {
            return Ok(new
            {
                id = meeting.Id,
                date = meeting.Date,
                notes = meeting.Notes
            });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "meeting.update",
            Entity = $"meeting:{meeting.Id}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            meeting.InternId,
            "meeting.reminder",
            "Meeting updated",
            $"Your meeting has been updated for {meeting.Date:u}.",
            $"meeting:{meeting.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = meeting.Id,
            date = meeting.Date,
            notes = meeting.Notes
        });
    }

    /// <summary>
    /// Annule une réunion.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur d annuler une réunion planifiée.
    /// Le stagiaire reçoit une notification d annulation.
    /// Cette action est irréversible.
    /// </remarks>
    /// <param name="id">Identifiant unique de la réunion à annuler.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Réunion annulée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Réunion non trouvée.</response>
    [HttpDelete("{id:guid}", Name = "DeleteMeeting")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteMeeting(Guid id, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var meeting = await dbContext.Meetings
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == supervisorId.Value, cancellationToken);

        if (meeting is null)
        {
            return NotFound(new { message = "Meeting not found." });
        }

        dbContext.Meetings.Remove(meeting);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "meeting.delete",
            Entity = $"meeting:{meeting.Id}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            meeting.InternId,
            "meeting.cancelled",
            "Meeting cancelled",
            "A scheduled meeting has been cancelled by your supervisor.",
            $"meeting:{meeting.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

}

public sealed class CreateMeetingRequest
{
    public Guid InternId { get; init; }

    public DateTime Date { get; init; }

    public string Notes { get; init; } = string.Empty;
}

public sealed class UpdateMeetingRequest
{
    public DateTime? Date { get; init; }

    public string? Notes { get; init; }
}
