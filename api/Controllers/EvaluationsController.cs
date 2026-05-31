using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Attributes;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des évaluations.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="supervisorScopeService">Service de résolution du périmètre des stagiaires superviseur.</param>
/// <param name="evaluationStatusService">Service métier des états d évaluation superviseur.</param>
[ApiController]
[Route("api/evaluations")]
[Authorize]
public sealed class EvaluationsController(
    AppDbContext dbContext,
    ISupervisorScopeService supervisorScopeService,
    IEvaluationStatusService evaluationStatusService,
    IMissionPolicyService missionPolicyService) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des évaluations.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les évaluations avec des filtres optionnels.
    /// Seuls les administrateurs peuvent accéder à cette route.
    /// Vous pouvez filtrer par statut, type, superviseur ou stagiaire.
    /// </remarks>
    /// <param name="status">Filtre par statut (pending, submitted).</param>
    /// <param name="type">Filtre par type (mid-term, end).</param>
    /// <param name="supervisorId">Filtre par identifiant de superviseur.</param>
    /// <param name="internId">Filtre par identifiant de stagiaire.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée d évaluations.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="400">Type invalide.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListEvaluations")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<EvaluationListItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListEvaluations(
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] Guid? supervisorId = null,
        [FromQuery] Guid? internId = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Evaluations
            .AsNoTracking()
            .Include(item => item.Intern)
            .Include(item => item.Supervisor)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(item => item.Status == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            var normalizedType = NormalizeEvaluationType(type);
            if (normalizedType is null)
            {
                return BadRequest(new { message = "type must be 'mid-term' or 'end'." });
            }

            query = query.Where(item => item.Type == normalizedType);
        }

        if (supervisorId.HasValue)
        {
            query = query.Where(item => item.SupervisorId == supervisorId.Value);
        }

        if (internId.HasValue)
        {
            query = query.Where(item => item.InternId == internId.Value);
        }

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderByDescending(item => item.SubmittedAt)
            .ThenByDescending(item => item.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(item => new EvaluationListItemResponse
            {
                Id = item.Id,
                SupervisorId = item.SupervisorId,
                SupervisorName = item.Supervisor != null
                    ? $"{item.Supervisor.FirstName} {item.Supervisor.LastName}".Trim()
                    : string.Empty,
                InternId = item.InternId,
                InternName = item.Intern != null
                    ? $"{item.Intern.FirstName} {item.Intern.LastName}".Trim()
                    : string.Empty,
                Type = item.Type,
                Status = item.Status,
                SubmittedAt = item.SubmittedAt,
                Comments = item.Comments,
                Criteria = new EvaluationCriteriaResponse
                {
                    Technical = item.Technical,
                    Autonomy = item.Autonomy,
                    Communication = item.Communication,
                    DeadlineRespect = item.DeadlineRespect,
                    DeliverableQuality = item.DeliverableQuality
                }
            })
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<EvaluationListItemResponse>
        {
            Data = data,
            Total = total,
            Page = safePage,
            Limit = safeLimit
        });
    }

    /// <summary>
    /// Récupère les évaluations en attente du superviseur.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les évaluations que le superviseur doit encore remplir.
    /// Seules les évaluations des stagiaires assignés au superviseur sont retournées.
    /// Les résultats sont triés par date de création.
    /// </remarks>
    /// <param name="supervisorId">Optionnel : filtre par identifiant de superviseur.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée d évaluations en attente.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="400">Paramètre supervisorId invalide.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("pending", Name = "ListPendingEvaluations")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor,Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPendingEvaluations(
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

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var effectiveSupervisorId = currentSupervisorId.Value;

        if (isAdminScope)
        {
            if (!string.IsNullOrWhiteSpace(supervisorId) &&
                !string.Equals(supervisorId, "me", StringComparison.OrdinalIgnoreCase))
            {
                if (!Guid.TryParse(supervisorId, out effectiveSupervisorId))
                {
                    return BadRequest(new { message = "Invalid supervisorId filter." });
                }
            }
        }
        else if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentSupervisorId.Value))
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(effectiveSupervisorId, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return Ok(new { data = Array.Empty<object>(), total = 0, page = safePage, limit = safeLimit });
        }

        var query = dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == effectiveSupervisorId &&
                                (evaluation.Status == DomainStatuses.Evaluation.Pending || evaluation.Status == DomainStatuses.Evaluation.Draft) &&
                                 assignedInternIds.Contains(evaluation.InternId));

        var total = await query.CountAsync(cancellationToken);

        var pendingData = await query
            .Include(evaluation => evaluation.Intern)
            .OrderBy(evaluation => evaluation.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(evaluation => new
            {
                id = evaluation.Id,
                internId = evaluation.InternId,
                internName = evaluation.Intern != null
                    ? $"{evaluation.Intern.FirstName} {evaluation.Intern.LastName}".Trim()
                    : string.Empty,
                type = evaluation.Type
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data = pendingData, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Récupère les évaluations dues et complétées du superviseur connecté.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Deux colonnes : évaluations à faire et évaluations terminées.</returns>
    [HttpGet("supervisor/me/status", Name = "GetSupervisorEvaluationStatus")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(EvaluationStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSupervisorEvaluationStatus(CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var response = await evaluationStatusService.GetSupervisorEvaluationStatusAsync(
            currentSupervisorId.Value,
            cancellationToken);

        return Ok(response);
    }

    /// <summary>
    /// Crée les évaluations en attente manquantes.
    /// </summary>
    /// <remarks>
    /// Cette route génère automatiquement les évaluations manquantes pour les stagiaires
    /// assignés au superviseur. Deux types d évaluation sont créés : mi-stage et fin de stage.
    /// Les évaluations déjà existantes ne sont pas recréées.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Un message indiquant le nombre d évaluations créées.</returns>
    /// <response code="200">Synchronisation réussie.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpPost("pending/sync", Name = "SyncPendingEvaluations")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(ActionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SyncPendingEvaluations(CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return Ok(new ActionResponse
            {
                Success = true,
                Message = "No pending evaluations to create."
            });
        }

        var existingEvaluations = await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == currentSupervisorId.Value &&
                                 assignedInternIds.Contains(evaluation.InternId))
            .Select(evaluation => new
            {
                evaluation.InternId,
                normalizedType = NormalizeEvaluationType(evaluation.Type)
            })
            .ToListAsync(cancellationToken);

        var existingKeys = existingEvaluations
            .Where(item => item.normalizedType is not null)
            .Select(item => $"{item.InternId:N}:{item.normalizedType}")
            .ToHashSet(StringComparer.Ordinal);

        var requiredTypes = new[] { "mid-term", "end" };
        var createdCount = 0;

        foreach (var internId in assignedInternIds)
        {
            foreach (var requiredType in requiredTypes)
            {
                var key = $"{internId:N}:{requiredType}";
                if (existingKeys.Contains(key))
                {
                    continue;
                }

                dbContext.Evaluations.Add(new Evaluation
                {
                    Id = Guid.NewGuid(),
                    SupervisorId = currentSupervisorId.Value,
                    InternId = internId,
                    Type = requiredType,
                    Status = DomainStatuses.Evaluation.Draft,
                    CreatedAt = DateTime.UtcNow
                });

                existingKeys.Add(key);
                createdCount++;
            }
        }

        if (createdCount > 0)
        {
            dbContext.AuditLogs.Add(new AuditLog
            {
                ActorUserId = currentSupervisorId,
                Actor = UserContextHelper.ResolveCurrentActorName(User),
                Action = "evaluation.pending.sync",
                Entity = $"count:{createdCount}",
                Timestamp = DateTime.UtcNow
            });

            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new ActionResponse
            {
                Success = true,
                Message = $"Created {createdCount} pending evaluation(s)."
            });
        }

        return Ok(new ActionResponse
        {
            Success = true,
            Message = "No pending evaluations to create."
        });
    }

    /// <summary>
    /// Soumet une évaluation de stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de remplir une évaluation pour un stagiaire.
    /// L évaluation comprend des notes de 0 à 10 sur différents critères techniques
    /// (technique, autonomie, communication, respect des délais, qualité des livrables).
    /// Un commentaire general peut être ajouté.
    /// </remarks>
    /// <param name="request">Objet contenant l identifiant du stagiaire, le type et les critères.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de l évaluation créée.</returns>
    /// <response code="201">Évaluation soumise avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpPost(Name = "SubmitEvaluation")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(EvaluationSupervisorResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SubmitEvaluation([FromBody] SubmitEvaluationRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        if (request.DeliverableId is null || request.DeliverableId == Guid.Empty)
        {
            return BadRequest(new { message = "deliverableId is required." });
        }

        var normalizedType = NormalizeEvaluationType(request.Type);
        if (normalizedType is null)
        {
            return BadRequest(new { message = "type must be 'mid-term' or 'end'." });
        }

        var deliverable = await dbContext.Deliverables
            .AsNoTracking()
            .Include(item => item.Mission)
            .Include(item => item.Intern)
            .FirstOrDefaultAsync(item => item.Id == request.DeliverableId.Value, cancellationToken);

        if (deliverable is null)
        {
            return BadRequest(new { message = "Deliverable not found." });
        }

        if (deliverable.Mission is null)
        {
            return BadRequest(new { message = "Deliverable must belong to a mission." });
        }

        if (!deliverable.InternId.HasValue)
        {
            return BadRequest(new { message = "Deliverable must be assigned to an intern before evaluation." });
        }

        if (await dbContext.Evaluations.AsNoTracking().AnyAsync(item => item.DeliverableId == deliverable.Id, cancellationToken))
        {
            return Conflict(new { message = "An evaluation already exists for this deliverable." });
        }

        var actorRole = UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty;
        if (!User.IsInRole("Admin") && !User.IsInRole("Manager") && !User.IsInRole("SuperAdmin"))
        {
            await missionPolicyService.CanEvaluateAsync(currentUserId.Value, actorRole, deliverable.MissionId);
            await missionPolicyService.AssertMissionNotArchivedAsync(deliverable.MissionId);
        }

        var criteria = request.Criteria ?? request.Scores;
        if (request.Criteria is not null && request.Scores is not null && !AreCriteriaEquivalent(request.Criteria, request.Scores))
        {
            return BadRequest(new { message = "Provide either criteria or scores, not conflicting values for both." });
        }

        if (criteria is not null && !AreScoresInRange(criteria))
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["score"] = "Score must be between 0 and 10."
            });
        }

        var evaluation = new Evaluation
        {
            Id = Guid.NewGuid(),
            SupervisorId = currentUserId.Value,
            InternId = deliverable.InternId.Value,
            DeliverableId = deliverable.Id,
            Type = normalizedType,
            Status = DomainStatuses.Evaluation.Draft,
            IsReleasedToIntern = false,
            Comments = request.Comments?.Trim() ?? string.Empty,
            PrivateNotes = request.PrivateNotes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        if (criteria is not null)
        {
            ApplyCriteria(evaluation, criteria);
            evaluation.OverallScore = HasAllCriteria(criteria) ? CalculateOverallScore(evaluation) : null;
        }

        dbContext.Evaluations.Add(evaluation);
        dbContext.EntityHistoryEntries.Add(CreateHistoryEntry(
            "Evaluation",
            evaluation.Id,
            "evaluation.created",
            currentUserId,
            deliverable.Id.ToString()));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsDuplicateDeliverableEvaluation(exception))
        {
            return Conflict(new { message = "An evaluation already exists for this deliverable." });
        }

        return CreatedAtAction(nameof(GetEvaluationById), new { id = evaluation.Id }, BuildSupervisorResponse(evaluation));
    }

    [HttpPost("{id:guid}/submit", Name = "SubmitEvaluationDraft")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(EvaluationSupervisorResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> FinalizeEvaluation(Guid id, CancellationToken cancellationToken)
    {
        var actorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorId.HasValue)
        {
            return Unauthorized();
        }

        var evaluation = await dbContext.Evaluations
            .Include(item => item.Deliverable)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (evaluation is null)
        {
            return NotFound(new { message = "Evaluation not found." });
        }

        if (!string.Equals(evaluation.Status, DomainStatuses.Evaluation.Draft, StringComparison.OrdinalIgnoreCase))
        {
            return UnprocessableEntity(new { message = "Evaluation cannot be submitted from its current state." });
        }

        if (!evaluation.OverallScore.HasValue)
        {
            return UnprocessableEntity(new { message = "All five criteria scores must be provided before submitting." });
        }

        if (!User.IsInRole("Admin") && !User.IsInRole("Manager") && !User.IsInRole("SuperAdmin"))
        {
            var missionId = await ResolveEvaluationMissionIdAsync(evaluation, actorId.Value, cancellationToken);
            if (!missionId.HasValue)
            {
                return Forbid();
            }

            await missionPolicyService.CanEvaluateAsync(
                actorId.Value,
                UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
                missionId.Value);

            await missionPolicyService.AssertMissionNotArchivedAsync(missionId.Value);
        }

        evaluation.Status = DomainStatuses.Evaluation.Submitted;
        evaluation.SubmittedAt = DateTime.UtcNow;

        dbContext.EntityHistoryEntries.Add(CreateHistoryEntry(
            "Evaluation",
            evaluation.Id,
            "evaluation.submitted",
            actorId,
            null));

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "evaluation.submitted",
            Entity = $"evaluation:{evaluation.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(BuildSupervisorResponse(evaluation));
    }

    [HttpPost("{id:guid}/release", Name = "ReleaseEvaluation")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(typeof(EvaluationSupervisorResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ReleaseEvaluation(Guid id, CancellationToken cancellationToken)
    {
        var actorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorId.HasValue)
        {
            return Unauthorized();
        }

        var evaluation = await dbContext.Evaluations
            .Include(item => item.Deliverable)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (evaluation is null)
        {
            return NotFound(new { message = "Evaluation not found." });
        }

        if (!string.Equals(evaluation.Status, DomainStatuses.Evaluation.Submitted, StringComparison.OrdinalIgnoreCase))
        {
            return UnprocessableEntity(new { message = "Evaluation must be submitted before releasing." });
        }

        evaluation.Deliverable ??= await dbContext.Deliverables
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == evaluation.DeliverableId, cancellationToken);

        if (evaluation.Deliverable is null)
        {
            return UnprocessableEntity(new { message = "The linked deliverable could not be found." });
        }

        if (!string.Equals(evaluation.Deliverable.Status, DomainStatuses.Deliverable.Approved, StringComparison.OrdinalIgnoreCase))
        {
            return UnprocessableEntity(new { message = "The deliverable must be approved before releasing its evaluation." });
        }

        evaluation.IsReleasedToIntern = true;
        evaluation.ReleasedAt = DateTime.UtcNow;
        evaluation.ReleasedByUserId = actorId.Value;
        evaluation.Status = DomainStatuses.Evaluation.Released;

        dbContext.EntityHistoryEntries.Add(CreateHistoryEntry(
            "Evaluation",
            evaluation.Id,
            "evaluation.released",
            actorId,
            null));

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "evaluation.released",
            Entity = $"Evaluation:{evaluation.Id}",
            Timestamp = DateTime.UtcNow
        });

        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = evaluation.InternId,
            Type = "evaluation.released",
            Title = "Your evaluation is available",
            Message = $"Your evaluation for '{evaluation.Deliverable.Title}' has been released.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(BuildSupervisorResponse(evaluation));
    }

    /// <summary>
    /// Met à jour une évaluation existante.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de modifier une évaluation.
    /// Vous pouvez changer le type, les critères, les commentaires ou le statut.
    /// Seuls les champs fournis sont mis à jour.
    /// </remarks>
    /// <param name="id">Identifiant unique de l évaluation.</param>
    /// <param name="request">Objet contenant les champs à mettre à jour.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour de l évaluation.</returns>
    /// <response code="200">Évaluation mise à jour avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Évaluation non trouvée.</response>
    [HttpPatch("{id:guid}", Name = "UpdateEvaluation")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(EvaluationSupervisorResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateEvaluation(Guid id, [FromBody] UpdateEvaluationRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var evaluation = await dbContext.Evaluations
            .Include(item => item.Deliverable)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (evaluation is null)
        {
            return NotFound(new { message = "Evaluation not found." });
        }

        if (!string.Equals(evaluation.Status, DomainStatuses.Evaluation.Draft, StringComparison.OrdinalIgnoreCase))
        {
            return UnprocessableEntity(new { message = "Evaluation cannot be edited after submission." });
        }

        if (!User.IsInRole("Admin") && !User.IsInRole("Manager") && !User.IsInRole("SuperAdmin"))
        {
            var missionId = await ResolveEvaluationMissionIdAsync(evaluation, currentUserId.Value, cancellationToken);
            if (!missionId.HasValue)
            {
                return Forbid();
            }

            await missionPolicyService.CanEvaluateAsync(
                currentUserId.Value,
                UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
                missionId.Value);

            await missionPolicyService.AssertMissionNotArchivedAsync(missionId.Value);
        }

        var changed = false;

        if (request.Criteria is not null)
        {
            if (!AreScoresInRange(request.Criteria))
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["score"] = "Score must be between 0 and 10."
                });
            }

            ApplyCriteria(evaluation, request.Criteria);
            evaluation.OverallScore = CalculateOverallScore(evaluation);
            changed = true;
        }

        if (request.Comments is not null)
        {
            evaluation.Comments = request.Comments.Trim();
            changed = true;
        }

        if (request.PrivateNotes is not null)
        {
            evaluation.PrivateNotes = request.PrivateNotes.Trim();
            changed = true;
        }

        if (!changed)
        {
            return Ok(BuildSupervisorResponse(evaluation));
        }

        dbContext.EntityHistoryEntries.Add(CreateHistoryEntry(
            "Evaluation",
            evaluation.Id,
            "evaluation.updated",
            currentUserId,
            null));

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(BuildSupervisorResponse(evaluation));
    }

    /// <summary>
    /// Récupère les détails d une évaluation.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les informations d une évaluation :
    /// type, statut, notes sur chaque critère et commentaires.
    /// Seul le superviseur propriétaire peut y accéder.
    /// </remarks>
    /// <param name="id">Identifiant unique de l évaluation.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les détails complets de l évaluation.</returns>
    /// <response code="200">Évaluation récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Évaluation non trouvée.</response>
    [HttpGet("{id:guid}", Name = "GetEvaluationById")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor,Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(EvaluationSupervisorResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(EvaluationInternResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetEvaluationById(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var actorRole = UserContextHelper.ResolveCurrentUserRole(User);

        var evaluation = await dbContext.Evaluations
            .AsNoTracking()
            .Include(item => item.Deliverable)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (evaluation is null)
        {
            return NotFound();
        }

        if (actorRole == UserRole.Intern)
        {
            if (evaluation.InternId != currentUserId.Value || !evaluation.IsReleasedToIntern)
            {
                return NotFound();
            }

            return Ok(BuildInternResponse(evaluation));
        }

        if (!User.IsInRole("Admin") && !User.IsInRole("Manager") && !User.IsInRole("SuperAdmin"))
        {
            var missionId = await ResolveEvaluationMissionIdAsync(evaluation, currentUserId.Value, cancellationToken);
            if (!missionId.HasValue)
            {
                return Forbid();
            }

            await missionPolicyService.CanEvaluateAsync(
                currentUserId.Value,
                actorRole?.ToString() ?? string.Empty,
                missionId.Value);

            await missionPolicyService.AssertMissionNotArchivedAsync(missionId.Value);
        }

        return Ok(BuildSupervisorResponse(evaluation));
    }

    private static EvaluationSupervisorResponse BuildSupervisorResponse(Evaluation evaluation)
    {
        return new EvaluationSupervisorResponse
        {
            Id = evaluation.Id,
            DeliverableId = evaluation.DeliverableId ?? Guid.Empty,
            Status = evaluation.Status,
            TechnicalScore = evaluation.Technical,
            AutonomyScore = evaluation.Autonomy,
            CommunicationScore = evaluation.Communication,
            DeadlineRespectScore = evaluation.DeadlineRespect,
            DeliverableQualityScore = evaluation.DeliverableQuality,
            OverallScore = evaluation.OverallScore,
            Comments = string.IsNullOrWhiteSpace(evaluation.Comments) ? null : evaluation.Comments,
            PrivateNotes = evaluation.PrivateNotes,
            IsReleasedToIntern = evaluation.IsReleasedToIntern,
            ReleasedAt = evaluation.ReleasedAt
        };
    }

    private static EvaluationInternResponse BuildInternResponse(Evaluation evaluation)
    {
        return new EvaluationInternResponse
        {
            Id = evaluation.Id,
            TechnicalScore = evaluation.Technical,
            AutonomyScore = evaluation.Autonomy,
            CommunicationScore = evaluation.Communication,
            DeadlineRespectScore = evaluation.DeadlineRespect,
            DeliverableQualityScore = evaluation.DeliverableQuality,
            OverallScore = evaluation.OverallScore ?? CalculateOverallScore(evaluation) ?? 0m,
            Comments = string.IsNullOrWhiteSpace(evaluation.Comments) ? null : evaluation.Comments,
            ReleasedAt = evaluation.ReleasedAt ?? DateTime.UtcNow
        };
    }

    private async Task<Mission?> ResolveMissionForEvaluationAsync(Guid actorUserId, Guid internId, CancellationToken cancellationToken)
    {
        return await dbContext.Missions
            .AsNoTracking()
            .Where(mission => mission.InternId == internId &&
                              (mission.SupervisorId == actorUserId || mission.CoSupervisorId == actorUserId))
            .OrderByDescending(mission => mission.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<Guid?> ResolveEvaluationMissionIdAsync(Evaluation evaluation, Guid actorUserId, CancellationToken cancellationToken)
    {
        if (evaluation.DeliverableId.HasValue)
        {
            var missionId = await dbContext.Deliverables
                .AsNoTracking()
                .Where(deliverable => deliverable.Id == evaluation.DeliverableId.Value)
                .Select(deliverable => (Guid?)deliverable.MissionId)
                .FirstOrDefaultAsync(cancellationToken);

            if (missionId.HasValue)
            {
                return missionId;
            }
        }

        var mission = await ResolveMissionForEvaluationAsync(actorUserId, evaluation.InternId, cancellationToken);
        return mission?.Id;
    }

    private static EvaluationCriteriaResponse ToCriteriaResponse(Evaluation evaluation)
    {
        return new EvaluationCriteriaResponse
        {
            Technical = evaluation.Technical,
            Autonomy = evaluation.Autonomy,
            Communication = evaluation.Communication,
            DeadlineRespect = evaluation.DeadlineRespect,
            DeliverableQuality = evaluation.DeliverableQuality
        };
    }

    /// <summary>
    /// Récupère les évaluations du stagiaire connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les évaluations soumises pour le stagiaire connecté.
    /// Les évaluations en attente ne sont pas visibles par le stagiaire.
    /// Les résultats sont triés par date de soumission.
    /// </remarks>
    /// <param name="page">Numéro de page (défaut: 1).</param>
    /// <param name="pageSize">Nombre d éléments par page (défaut: 20, max: 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste d évaluations avec les notes et commentaires.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("/api/intern/me/evaluations", Name = "ListMyEvaluations")]
    [FeatureCard(DashboardCard.Evaluation)]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(InternEvaluationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyEvaluations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 1, 100);

        var query = dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation =>
                evaluation.InternId == internId.Value &&
                evaluation.Status == DomainStatuses.Evaluation.Submitted &&
                evaluation.IsReleasedToIntern)
            .Include(evaluation => evaluation.Supervisor)
            .OrderByDescending(evaluation => evaluation.SubmittedAt)
            .ThenByDescending(evaluation => evaluation.CreatedAt);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(evaluation => new InternEvaluationResponse
            {
                Id = evaluation.Id,
                Type = NormalizeTypeForIntern(evaluation.Type),
                Status = evaluation.Status,
                Criteria = new EvaluationCriteriaResponse
                {
                    Technical = evaluation.Technical,
                    Autonomy = evaluation.Autonomy,
                    Communication = evaluation.Communication,
                    DeadlineRespect = evaluation.DeadlineRespect,
                    DeliverableQuality = evaluation.DeliverableQuality
                },
                OverallScore = evaluation.OverallScore,
                IsReleasedToIntern = evaluation.IsReleasedToIntern,
                ReleasedAt = evaluation.ReleasedAt,
                Date = evaluation.SubmittedAt ?? evaluation.CreatedAt,
                Comments = evaluation.Comments,
                SupervisorName = evaluation.Supervisor != null
                    ? $"{evaluation.Supervisor.FirstName} {evaluation.Supervisor.LastName}".Trim()
                    : string.Empty
            })
            .ToListAsync(cancellationToken);

        return Ok(new InternEvaluationsResponse
        {
            Data = data,
            Page = safePage,
            PageSize = safePageSize,
            Total = total
        });
    }

    private static bool AreScoresInRange(EvaluationCriteriaRequest criteria)
    {
         return (!criteria.Technical.HasValue || criteria.Technical is >= 0 and <= 10) &&
             (!criteria.Autonomy.HasValue || criteria.Autonomy is >= 0 and <= 10) &&
             (!criteria.Communication.HasValue || criteria.Communication is >= 0 and <= 10) &&
             (!criteria.DeadlineRespect.HasValue || criteria.DeadlineRespect is >= 0 and <= 10) &&
             (!criteria.DeliverableQuality.HasValue || criteria.DeliverableQuality is >= 0 and <= 10);
    }

    private static bool TryResolveCriteria(
        EvaluationCriteriaRequest? criteria,
        EvaluationCriteriaRequest? scores,
        out EvaluationCriteriaRequest resolvedCriteria,
        out string errorMessage)
    {
        errorMessage = string.Empty;

        if (criteria is null && scores is null)
        {
            resolvedCriteria = null!;
            errorMessage = "criteria is required.";
            return false;
        }

        if (criteria is not null && scores is not null &&
            !AreCriteriaEquivalent(criteria, scores))
        {
            resolvedCriteria = null!;
            errorMessage = "Provide either criteria or scores, not conflicting values for both.";
            return false;
        }

        resolvedCriteria = criteria ?? scores!;
        return true;
    }

    private static bool AreCriteriaEquivalent(EvaluationCriteriaRequest left, EvaluationCriteriaRequest right)
    {
        return left.Technical == right.Technical &&
               left.Autonomy == right.Autonomy &&
               left.Communication == right.Communication &&
               left.DeadlineRespect == right.DeadlineRespect &&
               left.DeliverableQuality == right.DeliverableQuality;
    }

    private static void ApplyCriteria(Evaluation evaluation, EvaluationCriteriaRequest criteria)
    {
        if (criteria.Technical.HasValue)
        {
            evaluation.Technical = criteria.Technical.Value;
        }

        if (criteria.Autonomy.HasValue)
        {
            evaluation.Autonomy = criteria.Autonomy.Value;
        }

        if (criteria.Communication.HasValue)
        {
            evaluation.Communication = criteria.Communication.Value;
        }

        if (criteria.DeadlineRespect.HasValue)
        {
            evaluation.DeadlineRespect = criteria.DeadlineRespect.Value;
        }

        if (criteria.DeliverableQuality.HasValue)
        {
            evaluation.DeliverableQuality = criteria.DeliverableQuality.Value;
        }
    }

    private static bool HasAllCriteria(EvaluationCriteriaRequest criteria)
    {
        return criteria.Technical.HasValue &&
               criteria.Autonomy.HasValue &&
               criteria.Communication.HasValue &&
               criteria.DeadlineRespect.HasValue &&
               criteria.DeliverableQuality.HasValue;
    }

    private static decimal? CalculateOverallScore(Evaluation evaluation)
    {
        return Math.Round(
            (evaluation.Technical +
             evaluation.Autonomy +
             evaluation.Communication +
             evaluation.DeadlineRespect +
             evaluation.DeliverableQuality) / 5.0m,
            2);
    }

    private static EntityHistoryEntry CreateHistoryEntry(string entityType, Guid entityId, string action, Guid? actorId, string? note = null)
    {
        return new EntityHistoryEntry
        {
            Id = Guid.NewGuid(),
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            ActorId = actorId,
            Note = note,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static bool IsDuplicateDeliverableEvaluation(DbUpdateException exception)
    {
        return exception.InnerException is SqlException sqlException &&
               (sqlException.Number is 2601 or 2627);
    }

    private static string? NormalizeEvaluationType(string? rawType)
    {
        if (string.IsNullOrWhiteSpace(rawType))
        {
            return null;
        }

        var normalized = rawType
            .Trim()
            .ToLowerInvariant()
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal);

        return normalized switch
        {
            "midterm" => "mid-term",
            "midparcours" => "mid-term",
            "midstage" => "mid-term",
            "end" => "end",
            "endofstage" => "end",
            "endstage" => "end",
            "endofinternship" => "end",
            _ => null
        };
    }

    private static string NormalizeTypeForIntern(string rawType)
    {
        var normalizedType = rawType.Trim().ToLowerInvariant();

        return normalizedType switch
        {
            "mid-term" => "mid_term",
            "end" => "end_of_internship",
            _ => normalizedType
        };
    }

}

public sealed class SubmitEvaluationRequest
{
    public Guid? DeliverableId { get; init; }

    public string Type { get; init; } = string.Empty;

    public EvaluationCriteriaRequest? Criteria { get; init; }

    [Obsolete("Use criteria instead of scores.")]
    public EvaluationCriteriaRequest? Scores { get; init; }

    public string Comments { get; init; } = string.Empty;

    public string? PrivateNotes { get; init; }
}

public sealed class UpdateEvaluationRequest
{
    public EvaluationCriteriaRequest? Criteria { get; init; }

    public string? Comments { get; init; }

    public string? PrivateNotes { get; init; }
}

public sealed class EvaluationCriteriaRequest
{
    public int? Technical { get; init; }

    public int? Autonomy { get; init; }

    public int? Communication { get; init; }

    public int? DeadlineRespect { get; init; }

    public int? DeliverableQuality { get; init; }
}
