using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des stages.
/// </summary>
/// <param name="service">Service de gestion des stages.</param>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/internships")]
[Authorize]
public sealed class InternshipsController(IInternshipsService service, AppDbContext dbContext) : ControllerBase
{
    private readonly IInternshipsService _service = service;
    private readonly AppDbContext _dbContext = dbContext;

    /// <summary>
    /// Récupère la liste des stages.
    /// </summary>
    /// <remarks>
    /// Cette route retourne tous les stages avec des filtres optionnels.
    /// Les superviseurs voient uniquement leurs propres stages.
    /// Les gestionnaires et administrateurs voient tous les stages.
    /// </remarks>
    /// <param name="status">Filtre par statut du stage.</param>
    /// <param name="department">Filtre par département.</param>
    /// <param name="supervisorId">Filtre par identifiant de superviseur.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée de stages.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="400">Paramètres invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListInternships")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [ProducesResponseType(typeof(PagedResponse<InternshipResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? department,
        [FromQuery] string? supervisorId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        if (User.IsInRole("Supervisor"))
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

            supervisorId = currentSupervisorId.Value.ToString();
        }

        try
        {
            var result = await _service.GetAllAsync(status, department, supervisorId, page, limit, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Récupère les détails d un stage.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les informations d un stage spécifique.
    /// Seuls les administrateurs, gestionnaires, le superviseur responsable
    /// et le stagiaire concerné peuvent accéder à ces informations.
    /// </remarks>
    /// <param name="id">Identifiant unique du stage.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les détails du stage.</returns>
    /// <response code="200">Stage récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Stage non trouvé.</response>
    [HttpGet("{id:guid}", Name = "GetInternshipById")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor,Intern")]
    [ProducesResponseType(typeof(InternshipResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInternshipById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _service.GetByIdAsync(id, cancellationToken);
        if (result is null)
        {
            return NotFound(new { message = "Internship not found." });
        }

        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var isAdmin = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var isManager = User.IsInRole("Manager");
        var isSupervisorScope = User.IsInRole("Supervisor") && result.SupervisorId == currentUserId.Value;
        var isInternScope = User.IsInRole("Intern") && result.InternId == currentUserId.Value;

        if (!isAdmin && !isManager && !isSupervisorScope && !isInternScope)
        {
            return Forbid();
        }

        return Ok(result);
    }

    /// <summary>
    /// Crée un nouveau stage.
    /// </summary>
    /// <remarks>
    /// Cette route permet de créer un stage pour un stagiaire.
    /// Les superviseurs peuvent uniquement créer des stages pour eux-mêmes.
    /// L identifiant du superviseur est automatiquement défini pour les superviseurs.
    /// </remarks>
    /// <param name="request">Objet contenant les informations du stage.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du stage créé.</returns>
    /// <response code="201">Stage créé avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="409">Conflit (stagiaire déjà en stage).</response>
    [HttpPost(Name = "CreateInternship")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(typeof(InternshipResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateInternshipRequest request, CancellationToken cancellationToken)
    {
        if (User.IsInRole("Supervisor"))
        {
            var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
            if (!currentSupervisorId.HasValue)
            {
                return Unauthorized();
            }

            if (!string.IsNullOrWhiteSpace(request.SupervisorId) &&
                (!Guid.TryParse(request.SupervisorId.Trim(), out var requestedSupervisorId) ||
                 requestedSupervisorId != currentSupervisorId.Value))
            {
                return Forbid();
            }

            request.SupervisorId = currentSupervisorId.Value.ToString();
        }

        var validationErrors = ValidateCreateDateRange(request.StartDate, request.EndDate);
        if (validationErrors.Count > 0)
        {
            return BadRequest(validationErrors);
        }

        try
        {
            var result = await _service.CreateAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetInternshipById), new { id = result.Id }, result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = exception.Message });
        }
    }

    private static Dictionary<string, string> ValidateCreateDateRange(DateTime startDate, DateTime endDate)
    {
        var errors = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (startDate == default)
        {
            errors["startDate"] = "StartDate is required.";
            return errors;
        }

        if (endDate == default)
        {
            errors["endDate"] = "EndDate is required.";
            return errors;
        }

        var normalizedStartDate = startDate.Kind == DateTimeKind.Utc
            ? startDate
            : startDate.ToUniversalTime();

        var normalizedEndDate = endDate.Kind == DateTimeKind.Utc
            ? endDate
            : endDate.ToUniversalTime();

        if (normalizedStartDate.Date < DateTime.UtcNow.Date)
        {
            errors["startDate"] = "StartDate must not be in the past.";
        }

        if (normalizedEndDate <= normalizedStartDate)
        {
            errors["endDate"] = "EndDate must be after StartDate.";
        }

        return errors;
    }

    /// <summary>
    /// Met à jour les informations d un stage.
    /// </summary>
    /// <remarks>
    /// Cette route permet aux administrateurs et superviseurs de modifier un stage.
    /// Les superviseurs peuvent uniquement modifier leurs propres stages.
    /// Seuls les champs fournis sont mis à jour.
    /// </remarks>
    /// <param name="id">Identifiant unique du stage.</param>
    /// <param name="request">Objet contenant les champs à mettre à jour.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour du stage.</returns>
    /// <response code="200">Stage mis à jour avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Stage non trouvé.</response>
    /// <response code="409">Conflit lors de la mise à jour.</response>
    [HttpPatch("{id:guid}", Name = "UpdateInternship")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [ProducesResponseType(typeof(InternshipResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateInternshipRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await _service.GetByIdAsync(id, cancellationToken);
        if (existing is null)
        {
            return NotFound(new { message = "Internship not found." });
        }

        if (User.IsInRole("Supervisor"))
        {
            var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
            if (!currentSupervisorId.HasValue)
            {
                return Unauthorized();
            }

            if (existing.SupervisorId != currentSupervisorId.Value)
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(request.SupervisorId) &&
                (!Guid.TryParse(request.SupervisorId.Trim(), out var requestedSupervisorId) ||
                 requestedSupervisorId != currentSupervisorId.Value))
            {
                return Forbid();
            }
        }

        try
        {
            var result = await _service.UpdateAsync(id, request, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = exception.Message });
        }
    }

    /// <summary>
    /// Supprime un stage.
    /// </summary>
    /// <remarks>
    /// Cette route permet aux administrateurs et superviseurs de supprimer un stage.
    /// Les superviseurs peuvent uniquement supprimer leurs propres stages.
    /// Cette action est irréversible.
    /// </remarks>
    /// <param name="id">Identifiant unique du stage à supprimer.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Stage supprimé avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Stage non trouvé.</response>
    /// <response code="409">Conflit lors de la suppression.</response>
    [HttpDelete("{id:guid}", Name = "DeleteInternship")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (User.IsInRole("Supervisor"))
        {
            var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
            if (!currentSupervisorId.HasValue)
            {
                return Unauthorized();
            }

            var existing = await _service.GetByIdAsync(id, cancellationToken);
            if (existing is null)
            {
                return NotFound(new { message = "Internship not found." });
            }

            if (existing.SupervisorId != currentSupervisorId.Value)
            {
                return Forbid();
            }
        }

        try
        {
            await _service.DeleteAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Internship not found." });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = exception.Message });
        }
    }

    /// <summary>
    /// Récupère l historique des modifications d un stage.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les modifications apportées à un stage.
    /// Seuls les administrateurs, gestionnaires, le superviseur responsable
    /// et le stagiaire concerné peuvent y accéder.
    /// </remarks>
    /// <param name="id">Identifiant unique du stage.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée des modifications.</returns>
    /// <response code="200">Historique récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Stage non trouvé.</response>
    [HttpGet("{id:guid}/history", Name = "GetInternshipHistory")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor,Intern")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistory(Guid id, [FromQuery] int page = 1, [FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        var mission = await _dbContext.Missions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Internship not found." });
        }

        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var isAdmin = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var isManager = User.IsInRole("Manager");
        var isSupervisorScope = User.IsInRole("Supervisor") && mission.SupervisorId == currentUserId.Value;
        var isInternScope = User.IsInRole("Intern") && mission.InternId == currentUserId.Value;

        if (!isAdmin && !isManager && !isSupervisorScope && !isInternScope)
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = _dbContext.MissionHistoryEntries
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
}
