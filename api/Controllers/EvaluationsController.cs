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
/// Contrôleur de gestion des évaluations.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/evaluations")]
[Authorize]
[EnableRateLimiting("write-operations")]
public sealed class EvaluationsController(AppDbContext dbContext, ISupervisorScopeService supervisorScopeService) : ControllerBase
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
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
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
            .Select(item => new
            {
                id = item.Id,
                supervisorId = item.SupervisorId,
                supervisorName = item.Supervisor != null
                    ? $"{item.Supervisor.FirstName} {item.Supervisor.LastName}".Trim()
                    : string.Empty,
                internId = item.InternId,
                internName = item.Intern != null
                    ? $"{item.Intern.FirstName} {item.Intern.LastName}".Trim()
                    : string.Empty,
                type = item.Type,
                status = item.Status,
                submittedAt = item.SubmittedAt,
                comments = item.Comments,
                criteria = new
                {
                    technical = item.Technical,
                    autonomy = item.Autonomy,
                    communication = item.Communication,
                    deadlineRespect = item.DeadlineRespect,
                    deliverableQuality = item.DeliverableQuality
                }
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
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
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("pending", Name = "ListPendingEvaluations")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
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

        if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentSupervisorId.Value))
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return Ok(new { data = Array.Empty<object>(), total = 0, page = safePage, limit = safeLimit });
        }

        var query = dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.SupervisorId == currentSupervisorId.Value &&
                                 evaluation.Status == DomainStatuses.Evaluation.Pending &&
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
    [Authorize(Roles = "Supervisor")]
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
                    Status = DomainStatuses.Evaluation.Pending,
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
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SubmitEvaluation([FromBody] SubmitEvaluationRequest request, CancellationToken cancellationToken)
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

        var normalizedType = NormalizeEvaluationType(request.Type);
        if (normalizedType is null)
        {
            return BadRequest(new { message = "type must be 'mid-term' or 'end'." });
        }

        if (!TryResolveCriteria(request.Criteria, request.Scores, out var criteria, out var criteriaError))
        {
            return BadRequest(new { message = criteriaError });
        }

        if (!AreScoresInRange(criteria))
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["score"] = "Score must be between 0 and 10."
            });
        }

        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(currentSupervisorId.Value, cancellationToken);
        if (!assignedInternIds.Contains(request.InternId))
        {
            return Forbid();
        }

        var internExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == request.InternId && user.Role == UserRole.Intern, cancellationToken);

        if (!internExists)
        {
            return BadRequest(new { message = "Intern not found." });
        }

        var evaluation = await dbContext.Evaluations
            .FirstOrDefaultAsync(item => item.SupervisorId == currentSupervisorId.Value &&
                                         item.InternId == request.InternId &&
                                         item.Type == normalizedType,
                                 cancellationToken);

        if (evaluation is null)
        {
            evaluation = new Evaluation
            {
                Id = Guid.NewGuid(),
                SupervisorId = currentSupervisorId.Value,
                InternId = request.InternId,
                Type = normalizedType,
                Status = DomainStatuses.Evaluation.Pending,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Evaluations.Add(evaluation);
        }

        evaluation.Technical = criteria.Technical;
        evaluation.Autonomy = criteria.Autonomy;
        evaluation.Communication = criteria.Communication;
        evaluation.DeadlineRespect = criteria.DeadlineRespect;
        evaluation.DeliverableQuality = criteria.DeliverableQuality;
        evaluation.Comments = request.Comments?.Trim() ?? string.Empty;
        evaluation.Status = DomainStatuses.Evaluation.Submitted;
        evaluation.SubmittedAt = DateTime.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentSupervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "evaluation.submit",
            Entity = $"evaluation:{evaluation.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var response = new
        {
            id = evaluation.Id,
            internId = evaluation.InternId,
            type = evaluation.Type
        };

        return CreatedAtAction(nameof(GetEvaluationById), new { id = evaluation.Id }, response);
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
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateEvaluation(Guid id, [FromBody] UpdateEvaluationRequest request, CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var evaluation = await dbContext.Evaluations
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == currentSupervisorId.Value, cancellationToken);

        if (evaluation is null)
        {
            return NotFound(new { message = "Evaluation not found." });
        }

        var hasChanges = false;

        if (request.Type is not null)
        {
            var normalizedType = NormalizeEvaluationType(request.Type);
            if (normalizedType is null)
            {
                return BadRequest(new { message = "type must be 'mid-term' or 'end'." });
            }

            if (!string.Equals(evaluation.Type, normalizedType, StringComparison.OrdinalIgnoreCase))
            {
                evaluation.Type = normalizedType;
                hasChanges = true;
            }
        }

        if (request.Criteria is not null)
        {
            if (!AreScoresInRange(request.Criteria))
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["score"] = "Score must be between 0 and 10."
                });
            }

            evaluation.Technical = request.Criteria.Technical;
            evaluation.Autonomy = request.Criteria.Autonomy;
            evaluation.Communication = request.Criteria.Communication;
            evaluation.DeadlineRespect = request.Criteria.DeadlineRespect;
            evaluation.DeliverableQuality = request.Criteria.DeliverableQuality;
            hasChanges = true;
        }

        if (request.Comments is not null)
        {
            var normalizedComments = request.Comments.Trim();
            if (!string.Equals(evaluation.Comments, normalizedComments, StringComparison.Ordinal))
            {
                evaluation.Comments = normalizedComments;
                hasChanges = true;
            }
        }

        if (request.Status is not null)
        {
            var normalizedStatus = request.Status.Trim().ToLowerInvariant();
            if (normalizedStatus is not (DomainStatuses.Evaluation.Pending or DomainStatuses.Evaluation.Submitted))
            {
                return BadRequest(new { message = "status must be 'pending' or 'submitted'." });
            }

            if (!string.Equals(evaluation.Status, normalizedStatus, StringComparison.OrdinalIgnoreCase))
            {
                evaluation.Status = normalizedStatus;
                evaluation.SubmittedAt = normalizedStatus == DomainStatuses.Evaluation.Submitted ? DateTime.UtcNow : null;
                hasChanges = true;
            }
        }

        if (!hasChanges)
        {
            return Ok(new
            {
                id = evaluation.Id,
                internId = evaluation.InternId,
                type = evaluation.Type,
                status = evaluation.Status
            });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentSupervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "evaluation.update",
            Entity = $"evaluation:{evaluation.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = evaluation.Id,
            internId = evaluation.InternId,
            type = evaluation.Type,
            status = evaluation.Status,
            submittedAt = evaluation.SubmittedAt
        });
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
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetEvaluationById(Guid id, CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var evaluation = await dbContext.Evaluations
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.SupervisorId == currentSupervisorId.Value, cancellationToken);

        if (evaluation is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            id = evaluation.Id,
            internId = evaluation.InternId,
            type = evaluation.Type,
            status = evaluation.Status,
            submittedAt = evaluation.SubmittedAt,
            comments = evaluation.Comments,
            criteria = new
            {
                technical = evaluation.Technical,
                autonomy = evaluation.Autonomy,
                communication = evaluation.Communication,
                deadlineRespect = evaluation.DeadlineRespect,
                deliverableQuality = evaluation.DeliverableQuality
            }
        });
    }

    /// <summary>
    /// Récupère les évaluations du stagiaire connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les évaluations soumises pour le stagiaire connecté.
    /// Les évaluations en attente ne sont pas visibles par le stagiaire.
    /// Les résultats sont triés par date de soumission.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste d évaluations avec les notes et commentaires.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("/api/intern/me/evaluations", Name = "ListMyEvaluations")]
    [Authorize(Roles = "Intern")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
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
                evaluation.Status == DomainStatuses.Evaluation.Submitted)
            .Include(evaluation => evaluation.Supervisor)
            .OrderByDescending(evaluation => evaluation.SubmittedAt)
            .ThenByDescending(evaluation => evaluation.CreatedAt);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(evaluation => new
            {
                id = evaluation.Id,
                type = NormalizeTypeForIntern(evaluation.Type),
                criteria = new
                {
                    technical = evaluation.Technical,
                    autonomy = evaluation.Autonomy,
                    communication = evaluation.Communication,
                    deadlineRespect = evaluation.DeadlineRespect,
                    deliverableQuality = evaluation.DeliverableQuality
                },
                scores = new
                {
                    technical = evaluation.Technical,
                    autonomy = evaluation.Autonomy,
                    communication = evaluation.Communication,
                    deadlineRespect = evaluation.DeadlineRespect,
                    deliverableQuality = evaluation.DeliverableQuality
                },
                date = evaluation.SubmittedAt ?? evaluation.CreatedAt,
                comments = evaluation.Comments,
                supervisorName = evaluation.Supervisor != null
                    ? $"{evaluation.Supervisor.FirstName} {evaluation.Supervisor.LastName}".Trim()
                    : string.Empty
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, page = safePage, pageSize = safePageSize, total });
    }

    private static bool AreScoresInRange(EvaluationCriteriaRequest criteria)
    {
        return criteria.Technical is >= 0 and <= 10 &&
               criteria.Autonomy is >= 0 and <= 10 &&
               criteria.Communication is >= 0 and <= 10 &&
               criteria.DeadlineRespect is >= 0 and <= 10 &&
               criteria.DeliverableQuality is >= 0 and <= 10;
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
    public Guid InternId { get; init; }

    public string Type { get; init; } = string.Empty;

    public EvaluationCriteriaRequest? Criteria { get; init; }

    [Obsolete("Use criteria instead of scores.")]
    public EvaluationCriteriaRequest? Scores { get; init; }

    public string Comments { get; init; } = string.Empty;
}

public sealed class UpdateEvaluationRequest
{
    public string? Type { get; init; }

    public EvaluationCriteriaRequest? Criteria { get; init; }

    public string? Comments { get; init; }

    public string? Status { get; init; }
}

public sealed class EvaluationCriteriaRequest
{
    public int Technical { get; init; }

    public int Autonomy { get; init; }

    public int Communication { get; init; }

    public int DeadlineRespect { get; init; }

    public int DeliverableQuality { get; init; }
}
