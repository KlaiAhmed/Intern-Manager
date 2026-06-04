using System.Data;
using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Attributes;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Exceptions;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des livrables.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="environment">Environnement d hébergement pour accéder aux fichiers.</param>
/// <param name="fileStorageService">Service de stockage de fichiers.</param>
/// <param name="deliverablesService">Service métier des livrables.</param>
/// <param name="missionPolicyService">Service de politique de mission.</param>
/// <param name="taskStateService">Service d’état des tâches.</param>
/// <param name="deliverableProgressService">Service de recalcul de progression des livrables.</param>
/// <param name="notificationService">Service pour envoyer des notifications.</param>
/// <param name="logger">Logger pour les événements du contrôleur.</param>
[ApiController]
[Route("api/deliverables")]
[Authorize]
public sealed class DeliverablesController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    IFileStorageService fileStorageService,
    IDeliverablesService deliverablesService,
    IMissionPolicyService missionPolicyService,
    ITaskStateService taskStateService,
    IDeliverableProgressService deliverableProgressService,
    INotificationService notificationService,
    ILogger<DeliverablesController> logger) : ControllerBase
{
    private const long MaxUploadBytes = 10 * 1024 * 1024;
    private const int MaxGitHubUrlLength = 2048;
    private const int MaxGitHubBranchLength = 200;
    private const int MaxSubmissionMessageLength = 2000;

private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
 {
 ".pdf",
 ".doc",
 ".docx",
 ".zip"
 };

 private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
 {
 "application/pdf",
 "application/msword",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 "application/zip",
 "application/x-zip-compressed"
 };

    /// <summary>
    /// Récupère la liste des livrables du superviseur connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne tous les livrables créés pour les stagiaires du superviseur.
    /// Vous pouvez filtrer par statut (pending, submitted, accepted, rejected).
    /// Les résultats sont triés par date de soumission, du plus récent au plus ancien.
    /// </remarks>
    /// <param name="status">Filtre par statut (pending, submitted, accepted, rejected).</param>
    /// <param name="supervisorId">Optionnel : filtre par identifiant de superviseur.</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée de livrables.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="400">Paramètre supervisorId invalide.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListDeliverables")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<DeliverableQueueItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDeliverables(
        [FromQuery] string? status = null,
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

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var effectiveSupervisorId = currentUserId.Value;

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
        else if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentUserId.Value))
        {
            return Forbid();
        }

        var response = await deliverablesService.GetSupervisorDeliverablesAsync(
            effectiveSupervisorId,
            status,
            page,
            limit,
            cancellationToken);

        return Ok(response);
    }

    /// <summary>
    /// Récupère la liste des livrables du stagiaire connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne tous les livrables assignés au stagiaire.
    /// Chaque livrable contient le titre, la date limite, le statut et la progression.
    /// Les résultats sont triés par date limite puis par date de création.
    /// </remarks>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée de livrables.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet("/api/intern/me/deliverables", Name = "ListMyDeliverables")]
    [FeatureCard(DashboardCard.Deliverables)]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyDeliverables(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.InternId == internId.Value);

        var total = await query.CountAsync(cancellationToken);

        var deliverableRows = await query
            .OrderBy(deliverable => deliverable.DueDate)
            .ThenByDescending(deliverable => deliverable.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(deliverable => new
            {
                deliverable.Id,
                deliverable.MissionId,
                deliverable.Title,
                deliverable.DueDate,
                deliverable.Status,
                deliverable.Version,
                deliverable.SupervisorComment,
                deliverable.RawProgress,
                deliverable.Weight,
                deliverable.RowVersion
            })
            .ToListAsync(cancellationToken);

        var data = deliverableRows
            .Select(deliverable => new InternDeliverableResponse
            {
                Id = deliverable.Id,
                MissionId = deliverable.MissionId,
                Title = deliverable.Title,
                DueDate = deliverable.DueDate,
                Status = NormalizeStatusForIntern(deliverable.Status),
                Version = deliverable.Version,
                SupervisorComment = deliverable.SupervisorComment,
                Progress = DisplayProgressHelper.ComputeDisplayProgress(deliverable.RawProgress, deliverable.Status),
                Weight = deliverable.Weight,
                RowVersion = deliverable.RowVersion
            })
            .ToList();

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }

    /// <summary>
    /// Télécharge le fichier d un livrable.
    /// </summary>
    /// <remarks>
    /// Cette route permet de récupérer le fichier soumis pour un livrable.
    /// Vous pouvez spécifier une version particulière ou obtenir la dernière par défaut.
    /// Seuls le stagiaire assigné, le superviseur propriétaire et les administrateurs
    /// peuvent accéder au fichier.
    /// </remarks>
    /// <param name="id">Identifiant unique du livrable.</param>
    /// <param name="version">Optionnel : numéro de version spécifique à télécharger.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le fichier demandé en téléchargement.</returns>
    /// <response code="200">Fichier retourné avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Livrable ou fichier non trouvé.</response>
    [HttpGet("{id:guid}/file", Name = "DownloadDeliverableFile")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadDeliverableFile(
        Guid id,
        [FromQuery] int? version = null,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var deliverable = await dbContext.Deliverables
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var isSupervisorScope = User.IsInRole("Supervisor") && deliverable.SupervisorId == currentUserId.Value;
        var isInternScope = User.IsInRole("Intern") && deliverable.InternId == currentUserId.Value;

        if (!isAdminScope && !isSupervisorScope && !isInternScope)
        {
            return Forbid();
        }

        DeliverableVersion? selectedVersion = null;
        if (version.HasValue)
        {
            selectedVersion = await dbContext.DeliverableVersions
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    item => item.DeliverableId == id && item.VersionNumber == version.Value,
                    cancellationToken);

            if (selectedVersion is null)
            {
                return NotFound(new { message = "Requested deliverable version was not found." });
            }
        }
        else
        {
            selectedVersion = await dbContext.DeliverableVersions
                .AsNoTracking()
                .Where(item => item.DeliverableId == id)
                .OrderByDescending(item => item.VersionNumber)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var fileUrl = selectedVersion?.FileUrl ?? deliverable.FileUrl;
        if (string.IsNullOrWhiteSpace(fileUrl))
        {
            return NotFound(new { message = "No file is associated with this deliverable." });
        }

        var relativePath = fileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(environment.ContentRootPath, relativePath);

        if (!System.IO.File.Exists(absolutePath))
        {
            return NotFound(new { message = "File not found in storage." });
        }

        var contentTypeProvider = new FileExtensionContentTypeProvider();
        if (!contentTypeProvider.TryGetContentType(absolutePath, out var contentType))
        {
            contentType = "application/octet-stream";
        }

        var downloadName = Path.GetFileName(absolutePath);
        return PhysicalFile(absolutePath, contentType, downloadName, enableRangeProcessing: true);
    }

    /// <summary>
    /// Creates a new deliverable submission version.
    /// </summary>
    [HttpPost("{deliverableId:guid}/versions", Name = "SubmitDeliverableVersion")]
    [FeatureCard(DashboardCard.Deliverables)]
    [Authorize(Roles = "Intern")]
    [EnableRateLimiting("upload")]
    [ProducesResponseType(typeof(DeliverableVersionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SubmitDeliverableVersion(
        Guid deliverableId,
        [FromForm] SubmitDeliverableVersionForm request,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var intern = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var hasFile = request.File is { Length: > 0 };
        var normalizedGitHubUrl = NormalizeOptionalText(request.GitHubUrl);
        var hasGitHubUrl = !string.IsNullOrWhiteSpace(normalizedGitHubUrl);

        if (hasFile && hasGitHubUrl)
        {
            return BadRequest(new { message = "Submit either a file or a GitHub URL, not both." });
        }

        if (!hasFile && !hasGitHubUrl)
        {
            return BadRequest(new { message = "A file or GitHub URL is required." });
        }

        string? fileExtension = null;
        if (hasFile)
        {
            var fileValidationError = ValidateSubmissionFile(request.File!);
            if (fileValidationError is not null)
            {
                return BadRequest(new { message = fileValidationError });
            }

            fileExtension = Path.GetExtension(request.File!.FileName);
        }

        if (hasGitHubUrl)
        {
            if (normalizedGitHubUrl!.Length > MaxGitHubUrlLength)
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["githubUrl"] = "GitHub URL cannot exceed 2048 characters."
                });
            }

            if (!IsRepoLevelGitHubUrl(normalizedGitHubUrl))
            {
                return BadRequest(new { message = "GitHub URL must be a repository-level URL such as https://github.com/owner/repo." });
            }
        }

        var normalizedGitHubBranch = NormalizeOptionalText(request.GitHubBranch);
        if (!hasGitHubUrl && normalizedGitHubBranch is not null)
        {
            return BadRequest(new { message = "GitHub branch requires a GitHub URL submission." });
        }

        if (normalizedGitHubBranch is { Length: > MaxGitHubBranchLength })
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["githubBranch"] = "GitHub branch cannot exceed 200 characters."
            });
        }

        var normalizedMessage = NormalizeOptionalText(request.Message);
        if (normalizedMessage is { Length: > MaxSubmissionMessageLength })
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["message"] = "Message cannot exceed 2000 characters."
            });
        }

        var deliverable = await dbContext.Deliverables
            .Include(item => item.Mission)
            .FirstOrDefaultAsync(item => item.Id == deliverableId, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        if (deliverable.InternId != internId.Value)
        {
            return Forbid();
        }

        if (deliverable.RowVersion != request.RowVersion)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                error = "conflict",
                message = "This record was modified. Please refresh."
            });
        }

        await missionPolicyService.CanSubmitEvidenceAsync(
            internId.Value,
            UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
            deliverable.MissionId,
            cancellationToken);

        await missionPolicyService.AssertMissionNotArchivedAsync(deliverable.MissionId);

        if (deliverable.Mission is null || !IsActiveMission(deliverable.Mission))
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Deliverable is not associated with an active mission." });
        }

        StoredFileInfo? storedFile = null;
        if (hasFile)
        {
            await using var uploadStream = request.File!.OpenReadStream();
            storedFile = await fileStorageService.SaveAsync(
                new FileStorageSaveRequest(
                    uploadStream,
                    $"deliverables/{deliverable.Id}",
                    request.File.FileName,
                    request.File.ContentType,
                    fileExtension),
                cancellationToken);
        }

        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)
                : null;

            try
            {
                var latestVersionNumber = await dbContext.DeliverableVersions
                    .AsNoTracking()
                    .Where(version => version.DeliverableId == deliverable.Id)
                    .Select(version => (int?)version.VersionNumber)
                    .MaxAsync(cancellationToken);

                var nextVersionNumber = ComputeNextVersionNumber(deliverable, latestVersionNumber);
                var submittedAt = DateTime.UtcNow;

                var existingVersions = await dbContext.DeliverableVersions
                    .Where(version => version.DeliverableId == deliverable.Id)
                    .ToListAsync(cancellationToken);

                foreach (var existingVersion in existingVersions)
                {
                    existingVersion.IsCurrentVersion = false;
                }

                var version = new DeliverableVersion
                {
                    Id = Guid.NewGuid(),
                    DeliverableId = deliverable.Id,
                    VersionNumber = nextVersionNumber,
                    IsCurrentVersion = true,
                    FileUrl = storedFile?.Url,
                    GitHubUrl = normalizedGitHubUrl,
                    GitHubBranch = normalizedGitHubBranch,
                    Message = normalizedMessage,
                    Status = DomainStatuses.DeliverableVersion.Submitted,
                    SupervisorComment = null,
                    SubmittedAt = submittedAt,
                    SubmittedByUserId = intern.Id
                };

                dbContext.DeliverableVersions.Add(version);

                deliverable.Version = nextVersionNumber;
                deliverable.FileUrl = storedFile?.Url ?? string.Empty;
                deliverable.SubmittedDate = submittedAt;
                deliverable.Status = DomainStatuses.Deliverable.AwaitingReview;
                deliverable.SupervisorComment = null;
                deliverable.RowVersion += 1;

                var linkedTasks = await dbContext.InternTasks
                    .Where(task => task.DeliverableId == deliverable.Id && task.Status != DomainStatuses.Task.Done)
                    .ToListAsync(cancellationToken);

                foreach (var task in linkedTasks)
                {
                    await taskStateService.MarkDoneAsync(task.Id, internId.Value, task.RowVersion, isSupervisorOverride: false, dbContext);
                }

                await deliverableProgressService.RecalculateAsync(deliverable.Id, dbContext);

                dbContext.EntityHistoryEntries.Add(new EntityHistoryEntry
                {
                    Id = Guid.NewGuid(),
                    EntityType = "Deliverable",
                    EntityId = deliverable.Id,
                    Action = "deliverable.submitted",
                    ActorId = internId.Value,
                    CreatedAt = submittedAt
                });

                dbContext.AuditLogs.Add(new AuditLog
                {
                    ActorUserId = internId,
                    Actor = UserContextHelper.ResolveCurrentActorName(User),
                    Action = "deliverable.version.submit",
                    Entity = $"deliverable:{deliverable.Id} version:{version.VersionNumber}",
                    Timestamp = submittedAt
                });

                await dbContext.SaveChangesAsync(cancellationToken);

                if (transaction is not null)
                {
                    await transaction.CommitAsync(cancellationToken);
                }

                return Created(
                    $"/api/deliverables/{deliverable.Id}/versions/{version.Id}",
                    ToVersionResponse(version, intern));
            }
            catch
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                }

                if (storedFile is not null)
                {
                    try
                    {
                        await fileStorageService.DeleteAsync(storedFile.Url, cancellationToken);
                    }
                    catch (Exception cleanupException)
                    {
                        logger.LogWarning(cleanupException, "Failed to delete stored deliverable file after version submission failure.");
                    }
                }

                throw;
            }
        });
    }

    /// <summary>
    /// Returns the version history for a deliverable.
    /// </summary>
    [HttpGet("{deliverableId:guid}/versions", Name = "ListDeliverableVersions")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor,Intern")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(DeliverableVersionHistoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDeliverableVersions(
        Guid deliverableId,
        CancellationToken cancellationToken)
    {
        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var deliverable = await dbContext.Deliverables
            .AsNoTracking()
            .Include(item => item.Mission)
            .FirstOrDefaultAsync(item => item.Id == deliverableId, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var isSupervisorScope = User.IsInRole("Supervisor") &&
            (deliverable.SupervisorId == currentUserId.Value ||
             (deliverable.Mission?.CoSupervisorId == currentUserId.Value &&
              deliverable.Mission.CoSupervisorCanReview));
        var isInternScope = User.IsInRole("Intern") &&
            (deliverable.InternId == currentUserId.Value ||
             deliverable.Mission?.InternId == currentUserId.Value);

        if (!isAdminScope && !isSupervisorScope && !isInternScope)
        {
            return Forbid();
        }

        var versions = await dbContext.DeliverableVersions
            .AsNoTracking()
            .Include(version => version.SubmittedByUser)
            .Where(version => version.DeliverableId == deliverable.Id)
            .OrderByDescending(version => version.VersionNumber)
            .ThenByDescending(version => version.SubmittedAt)
            .ToListAsync(cancellationToken);

        var response = new DeliverableVersionHistoryResponse
        {
            Deliverable = new DeliverableVersionParentSummaryResponse
            {
                Id = deliverable.Id,
                MissionId = deliverable.MissionId,
                Title = deliverable.Title,
                Status = NormalizeStatusForIntern(deliverable.Status),
                Version = deliverable.Version,
                Progress = DisplayProgressHelper.ComputeDisplayProgress(deliverable.RawProgress, deliverable.Status),
                DueDate = deliverable.DueDate,
                SubmittedDate = deliverable.SubmittedDate,
                SupervisorComment = deliverable.SupervisorComment
            },
            Versions = versions
                .Select(version => ToVersionResponse(version, version.SubmittedByUser))
                .ToArray()
        };

        return Ok(response);
    }

    /// <summary>
    /// Soumet un fichier pour un livrable.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de soumettre un fichier pour un livrable.
    /// Le fichier peut être en PDF, Word, Excel, PowerPoint, texte ou image.
    /// La taille maximale est de 10 Mo. Chaque soumission crée une nouvelle version.
    /// Le statut passe automatiquement à \"soumis\".
    /// </remarks>
    /// <param name="id">Identifiant unique du livrable.</param>
    /// <param name="request">Objet contenant le fichier à soumettre.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du livrable soumis.</returns>
    /// <response code="201">Fichier soumis avec succès.</response>
    /// <response code="400">Fichier invalide ou trop volumineux.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Livrable non trouvé.</response>
    [HttpPost("{id:guid}/submit", Name = "SubmitDeliverable")]
    [FeatureCard(DashboardCard.Deliverables)]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [EnableRateLimiting("upload")]
    [ProducesResponseType(typeof(InternDeliverableResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> SubmitDeliverable(
        Guid id,
        [FromBody] SubmitDeliverableRequest request,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var normalizedFileUrl = NormalizeOptionalText(request.FileUrl);
        var normalizedGitHubUrl = NormalizeOptionalText(request.GitHubUrl);
        var normalizedGitHubBranch = NormalizeOptionalText(request.GitHubBranch);
        var normalizedMessage = NormalizeOptionalText(request.Message);

        var deliverable = await dbContext.Deliverables
            .Include(item => item.Mission)
            .Include(item => item.Intern)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        if (deliverable.InternId != internId.Value)
        {
            return Forbid();
        }

        await missionPolicyService.CanSubmitEvidenceAsync(
            internId.Value,
            UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
            deliverable.MissionId,
            cancellationToken);

        await missionPolicyService.AssertMissionNotArchivedAsync(deliverable.MissionId);

        if (deliverable.Mission is null || !IsActiveMission(deliverable.Mission))
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Deliverable is not associated with an active mission." });
        }

        if (IsAwaitingReviewStatus(deliverable.Status))
        {
            return UnprocessableEntity(new { message = "Deliverable is already pending review." });
        }

        if (IsApprovedStatus(deliverable.Status))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "This deliverable has been approved." });
        }

        if (!IsSubmittableStatus(deliverable.Status))
        {
            return UnprocessableEntity(new { message = "Deliverable cannot be submitted in its current status." });
        }

        var hasFileUrl = !string.IsNullOrWhiteSpace(normalizedFileUrl);
        var hasGitHubUrl = !string.IsNullOrWhiteSpace(normalizedGitHubUrl);

        if (hasFileUrl == hasGitHubUrl)
        {
            return UnprocessableEntity(new { message = "You must provide either a file URL or a GitHub URL, but not both." });
        }

        if (normalizedFileUrl is { Length: > MaxGitHubUrlLength })
        {
            return UnprocessableEntity(new { message = "File URL cannot exceed 2048 characters." });
        }

        if (normalizedGitHubUrl is { Length: > MaxGitHubUrlLength })
        {
            return UnprocessableEntity(new { message = "GitHub URL cannot exceed 2048 characters." });
        }

        if (hasGitHubUrl && !IsRepoLevelGitHubUrl(normalizedGitHubUrl!))
        {
            return UnprocessableEntity(new { message = "GitHub URL must be a repository-level URL such as https://github.com/owner/repo." });
        }

        if (!hasGitHubUrl && normalizedGitHubBranch is not null)
        {
            return UnprocessableEntity(new { message = "GitHub branch requires a GitHub URL submission." });
        }

        if (normalizedGitHubBranch is { Length: > MaxGitHubBranchLength })
        {
            return UnprocessableEntity(new { message = "GitHub branch cannot exceed 200 characters." });
        }

        if (normalizedMessage is { Length: > MaxSubmissionMessageLength })
        {
            return UnprocessableEntity(new { message = "Message cannot exceed 2000 characters." });
        }

        var incompleteTaskCount = await dbContext.InternTasks
            .AsNoTracking()
            .CountAsync(
                task => task.DeliverableId == deliverable.Id &&
                    task.InternId == internId.Value &&
                    task.Status != DomainStatuses.Task.Done,
                cancellationToken);

        if (incompleteTaskCount > 0)
        {
            return UnprocessableEntity(new
            {
                message = $"All tasks must be completed before submission. {incompleteTaskCount} task(s) are not complete."
            });
        }

        if (deliverable.RowVersion != request.RowVersion)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                error = "conflict",
                message = "This record was modified. Please refresh."
            });
        }

        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)
                : null;

            try
            {
                var latestVersionNumber = await dbContext.DeliverableVersions
                    .AsNoTracking()
                    .Where(version => version.DeliverableId == deliverable.Id)
                    .Select(version => (int?)version.VersionNumber)
                    .MaxAsync(cancellationToken) ?? 0;

                var existingVersions = await dbContext.DeliverableVersions
                    .Where(version => version.DeliverableId == deliverable.Id)
                    .ToListAsync(cancellationToken);

                foreach (var existingVersion in existingVersions)
                {
                    existingVersion.IsCurrentVersion = false;
                }

                var submittedAt = DateTime.UtcNow;
                var nextVersionNumber = latestVersionNumber + 1;

                dbContext.DeliverableVersions.Add(new DeliverableVersion
                {
                    Id = Guid.NewGuid(),
                    DeliverableId = deliverable.Id,
                    VersionNumber = nextVersionNumber,
                    IsCurrentVersion = true,
                    FileUrl = normalizedFileUrl,
                    GitHubUrl = normalizedGitHubUrl,
                    GitHubBranch = normalizedGitHubBranch,
                    Message = normalizedMessage,
                    Status = DomainStatuses.DeliverableVersion.Submitted,
                    SupervisorComment = null,
                    SubmittedAt = submittedAt,
                    SubmittedByUserId = internId.Value
                });

                deliverable.Status = DomainStatuses.Deliverable.AwaitingReview;
                deliverable.SubmittedDate = submittedAt;
                deliverable.FileUrl = normalizedFileUrl ?? string.Empty;
                deliverable.SupervisorComment = null;
                deliverable.Version = nextVersionNumber;
                deliverable.RowVersion += 1;

                dbContext.EntityHistoryEntries.Add(new EntityHistoryEntry
                {
                    Id = Guid.NewGuid(),
                    EntityType = "Deliverable",
                    EntityId = deliverable.Id,
                    Action = "deliverable.submitted",
                    ActorId = internId.Value,
                    CreatedAt = submittedAt
                });

                var internName = deliverable.Intern is null
                    ? "An intern"
                    : $"{deliverable.Intern.FirstName} {deliverable.Intern.LastName}".Trim();
                if (string.IsNullOrWhiteSpace(internName))
                {
                    internName = "An intern";
                }

                var notificationMessage = $"{internName} submitted '{deliverable.Title}'";
                notificationService.QueueNotification(
                    deliverable.Mission.SupervisorId,
                    "deliverable.submitted",
                    "New submission awaiting review",
                    notificationMessage,
                    deliverable.Id.ToString());

                if (deliverable.Mission.CoSupervisorCanReview && deliverable.Mission.CoSupervisorId.HasValue)
                {
                    notificationService.QueueNotification(
                        deliverable.Mission.CoSupervisorId.Value,
                        "deliverable.submitted",
                        "New submission awaiting review",
                        notificationMessage,
                        deliverable.Id.ToString());
                }

                await dbContext.SaveChangesAsync(cancellationToken);

                if (transaction is not null)
                {
                    await transaction.CommitAsync(cancellationToken);
                }

                var response = new InternDeliverableResponse
                {
                    Id = deliverable.Id,
                    MissionId = deliverable.MissionId,
                    Title = deliverable.Title,
                    DueDate = deliverable.DueDate,
                    Status = NormalizeStatusForIntern(deliverable.Status),
                    Version = deliverable.Version,
                    SupervisorComment = deliverable.SupervisorComment,
                    Progress = DisplayProgressHelper.ComputeDisplayProgress(deliverable.RawProgress, deliverable.Status),
                    Weight = deliverable.Weight,
                    RowVersion = deliverable.RowVersion
                };

                return Ok(response);
            }
            catch
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                }

                throw;
            }
        });
    }

    /// <summary>
    /// Met à jour la progression d un livrable.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire d indiquer son avancement sur un livrable.
    /// La progression est un pourcentage entre 0 et 100. Si la progression atteint 100,
    /// le livrable est automatiquement marqué comme terminé.
    /// </remarks>
    /// <param name="id">Identifiant unique du livrable.</param>
    /// <param name="request">Objet contenant le pourcentage de progression.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>La progression mise à jour.</returns>
    /// <response code="200">Progression mise à jour avec succès.</response>
    /// <response code="400">Valeur de progression invalide.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Livrable non trouvé.</response>


    /// <summary>
    /// Valide ou refuse un livrable soumis.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de valider (accepter) ou refuser un livrable
    /// qui a été soumis par un stagiaire. Vous pouvez ajouter un commentaire.
    /// Le stagiaire reçoit une notification du résultat.
    /// Seuls les livrables avec le statut \"soumis\" peuvent être validés.
    /// </remarks>
    /// <param name="id">Identifiant unique du livrable.</param>
    /// <param name="request">Objet contenant le statut (accepted/rejected) et un commentaire.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le statut mis à jour du livrable.</returns>
    /// <response code="200">Livrable validé avec succès.</response>
    /// <response code="400">Statut invalide.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Livrable non trouvé.</response>
    /// <response code="409">Conflit de concurrence : le livrable a été modifié depuis le chargement de la version concurrente transmise.</response>
    /// <response code="422">Le livrable n est pas en attente de revue.</response>
    [HttpPost("{id:guid}/approve", Name = "ApproveDeliverable")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(DeliverableReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ApproveDeliverable(
        Guid id,
        [FromBody] ApproveDeliverableRequest request,
        CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var permissionResult = await AuthorizeDeliverableReviewAsync(id, currentSupervisorId.Value, cancellationToken);
        if (permissionResult is not null)
        {
            return permissionResult;
        }

        try
        {
            var response = await deliverablesService.ApproveDeliverableAsync(
                currentSupervisorId.Value,
                id,
                request.RowVersion,
                cancellationToken);

            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ConflictPayload());
            }

            return Ok(response);
        }
        catch (ConcurrencyException)
        {
            return Conflict(ConflictPayload());
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return UnprocessableEntity(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Refuse un livrable soumis et rouvre les tâches sélectionnées.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de refuser un livrable soumis par un stagiaire.
    /// Le superviseur doit fournir un motif (10 à 1000 caractères) et sélectionner au moins
    /// une tâche à rouvrir si le livrable possède des tâches.
    /// Le statut du livrable passe à <c>changes_requested</c> et chaque tâche listée dans
    /// <c>TaskIdsToReopen</c> passe au statut <c>reopened</c>.
    /// Le stagiaire reçoit une notification du refus.
    /// </remarks>
    /// <param name="id">Identifiant unique du livrable.</param>
    /// <param name="request">Objet contenant le motif, les identifiants de tâches à rouvrir et la version concurrente attendue.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le statut mis à jour du livrable.</returns>
    /// <response code="200">Livrable refusé avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Livrable non trouvé.</response>
    /// <response code="409">Conflit de concurrence (le livrable a été modifié depuis le chargement) ou livrable pas en attente de revue.</response>
    /// <response code="422">Motif invalide, identifiants de tâches manquants ou incohérents.</response>
    [HttpPost("{id:guid}/reject", Name = "RejectDeliverable")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(typeof(DeliverableReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> RejectDeliverable(
        Guid id,
        [FromBody] RejectDeliverableRequest request,
        CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        var permissionResult = await AuthorizeDeliverableReviewAsync(id, currentSupervisorId.Value, cancellationToken);
        if (permissionResult is not null)
        {
            return permissionResult;
        }

        try
        {
            var response = await deliverablesService.RejectDeliverableAsync(
                currentSupervisorId.Value,
                id,
                request.Reason,
                request.TaskIdsToReopen,
                request.RowVersion,
                cancellationToken);

            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ConflictPayload());
            }

            return Ok(response);
        }
        catch (ConcurrencyException)
        {
            return Conflict(ConflictPayload());
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return UnprocessableEntity(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return UnprocessableEntity(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Assigne un nouveau livrable à un stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route permet au superviseur de créer un livrable pour un stagiaire.
    /// Le livrable est lié à une mission existante du superviseur.
    /// Le stagiaire reçoit une notification lors de l assignation.
    /// </remarks>
    /// <param name="request">Objet contenant les informations du livrable (stagiaire, titre, date limite).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du livrable créé.</returns>
    /// <response code="201">Livrable assigné avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpPost(Name = "AssignDeliverable")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AssignDeliverable([FromBody] AssignDeliverableRequest request, CancellationToken cancellationToken)
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

        if (request.MissionId == Guid.Empty)
        {
            return BadRequest(new { message = "missionId is required." });
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

        var mission = await dbContext.Missions
            .AsNoTracking()
            .FirstOrDefaultAsync(mission => mission.Id == request.MissionId, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Mission not found." });
        }

        await missionPolicyService.CanCreateTaskAsync(
            supervisorId.Value,
            UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
            mission.Id);

        await missionPolicyService.AssertMissionNotArchivedAsync(mission.Id);

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        if (!isAdminScope)
        {
            var canAssign = await dbContext.MissionInternAssignments
                .AsNoTracking()
                .AnyAsync(assignment => 
                    assignment.MissionId == request.MissionId && 
                    assignment.InternId == request.InternId, cancellationToken);

            if (!canAssign)
            {
                return Forbid();
            }
        }

        var normalizedDueDate = request.DueDate.HasValue
            ? (request.DueDate.Value.Kind == DateTimeKind.Utc
                ? request.DueDate.Value
                : request.DueDate.Value.ToUniversalTime())
            : (DateTime?)null;

var deliverable = new Deliverable
{
    Id = Guid.NewGuid(),
    MissionId = request.MissionId,
    SupervisorId = supervisorId.Value,
    InternId = request.InternId,
    Title = request.Title.Trim(),
    Description = request.Description?.Trim(),
    Status = DomainStatuses.Deliverable.Pending,
    DueDate = normalizedDueDate,
    RawProgress = 0m,
    Version = 1,
    CreatedAt = DateTime.UtcNow
};

        dbContext.Deliverables.Add(deliverable);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "deliverable.assign",
            Entity = $"deliverable:{deliverable.Id} intern:{deliverable.InternId}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            deliverable.InternId.Value,
            "deliverable.assigned",
            "New deliverable assigned",
            $"Deliverable '{deliverable.Title}' has been assigned to you.",
            $"deliverable:{deliverable.Id}");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Created($"/api/deliverables/{deliverable.Id}", new
        {
            id = deliverable.Id,
            internId = deliverable.InternId,
            title = deliverable.Title,
            dueDate = deliverable.DueDate,
            status = deliverable.Status,
            progress = DisplayProgressHelper.ComputeDisplayProgress(deliverable.RawProgress, deliverable.Status)
        });
    }

    /// <summary>
    /// Returns all deliverables for the specified mission. Scoped to missions owned by
    /// or co-supervised by the requesting supervisor. Returns a flat array; does not paginate.
    /// </summary>
    /// <param name="missionId">Identifiant unique de la mission.</param>
    /// <param name="status">Filtre optionnel par statut (ex. submitted, accepted, rejected).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste plate de livrables pour la mission.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Le superviseur n est pas propriétaire ni co-superviseur de la mission.</response>
    /// <response code="404">Mission introuvable.</response>
    [HttpGet("mission/{missionId:guid}", Name = "GetDeliverablesByMission")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(IReadOnlyList<DeliverableQueueItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDeliverablesByMission(
        Guid missionId,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var isAdminScope = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");

        var mission = await dbContext.Missions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == missionId, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Mission not found." });
        }

        if (!isAdminScope &&
            mission.SupervisorId != supervisorId.Value &&
            mission.CoSupervisorId != supervisorId.Value)
        {
            return Forbid();
        }

        var query = dbContext.Deliverables
            .AsNoTracking()
            .Include(deliverable => deliverable.Intern)
            .Include(deliverable => deliverable.Tasks)
            .Where(deliverable => deliverable.MissionId == missionId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(deliverable => deliverable.Status == normalizedStatus);
        }

        var deliverables = await query
            .OrderByDescending(deliverable => deliverable.SubmittedDate)
            .ThenByDescending(deliverable => deliverable.CreatedAt)
            .Select(deliverable => new DeliverableQueueItemResponse
            {
                Id = deliverable.Id,
                Title = deliverable.Title,
                InternId = deliverable.InternId,
                InternName = deliverable.Intern != null
                    ? $"{deliverable.Intern.FirstName} {deliverable.Intern.LastName}".Trim()
                    : string.Empty,
                SubmittedDate = deliverable.SubmittedDate,
                DueDate = deliverable.DueDate,
                Status = deliverable.Status,
                Version = deliverable.Version,
                FileUrl = string.IsNullOrWhiteSpace(deliverable.FileUrl)
                    ? "#"
                    : deliverable.FileUrl,
                RowVersion = deliverable.RowVersion,
                RawProgress = deliverable.RawProgress,
                Tasks = deliverable.Tasks
                    .Where(task => task.Status != DomainStatuses.Task.Cancelled)
                    .OrderBy(task => task.CreatedAt)
                    .Select(task => new DeliverableQueueTaskResponse
                    {
                        Id = task.Id,
                        Title = task.Title,
                        Status = task.Status,
                        RowVersion = task.RowVersion
                    })
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return Ok(deliverables);
    }

    /// <summary>
    /// Deletes a deliverable. The requesting user must own the mission that contains the deliverable.
    /// </summary>
    /// <remarks>
    /// Authorized for the supervisor assigned to the mission that contains the deliverable,
    /// plus <c>Admin</c> and <c>SuperAdmin</c> roles. Returns <c>404 Not Found</c> when the
    /// deliverable does not exist or the caller is not authorized, matching the soft-404
    /// pattern used by <c>DELETE /api/meetings/{id}</c> and <c>DELETE /api/missions/{id}</c>.
    /// EF Core cascade-deletes the associated <c>DeliverableVersion</c> rows via the
    /// <c>OnDelete(DeleteBehavior.Cascade)</c> configuration on <c>Deliverable.Versions</c>.
    /// Linked <c>InternTask</c> rows are NOT deleted: their <c>DeliverableId</c> foreign key is
    /// set to <c>null</c> by <c>OnDelete(DeleteBehavior.SetNull)</c> in the EF model configuration.
    /// </remarks>
    /// <param name="id">Unique identifier of the deliverable to delete.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    /// <response code="204">Deliverable deleted successfully.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="404">Deliverable not found, or the requesting supervisor does not own the mission that contains it.</response>
    [HttpDelete("{id:guid}", Name = "DeleteDeliverable")]
    // RBAC policy: endpoints available to Supervisor must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("delete-operations")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDeliverable(Guid id, CancellationToken cancellationToken)
    {
        var supervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!supervisorId.HasValue)
        {
            return Unauthorized();
        }

        var deliverable = await dbContext.Deliverables
            .Include(item => item.Mission)
            .FirstOrDefaultAsync(
                item => item.Id == id &&
                        item.Mission != null &&
                        item.Mission.SupervisorId == supervisorId.Value,
                cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = supervisorId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "deliverable.delete",
            Entity = $"deliverable:{deliverable.Id}",
            Timestamp = DateTime.UtcNow
        });

        dbContext.Deliverables.Remove(deliverable);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task<IActionResult?> AuthorizeDeliverableReviewAsync(
        Guid deliverableId,
        Guid actorId,
        CancellationToken cancellationToken)
    {
        var deliverable = await dbContext.Deliverables
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == deliverableId, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        await missionPolicyService.CanReviewDeliverableAsync(
            actorId,
            UserContextHelper.ResolveCurrentUserRole(User)?.ToString() ?? string.Empty,
            deliverable.MissionId);

        await missionPolicyService.AssertMissionNotArchivedAsync(deliverable.MissionId);

        return null;
    }

    private static object ConflictPayload()
    {
        return new
        {
            error = "conflict",
            message = "This record was modified by another request. Please refresh and try again."
        };
    }

    private static DeliverableVersionResponse ToVersionResponse(DeliverableVersion version, User? submittedByUser)
    {
        return new DeliverableVersionResponse
        {
            Id = version.Id,
            DeliverableId = version.DeliverableId,
            VersionNumber = version.VersionNumber,
            IsCurrentVersion = version.IsCurrentVersion,
            FileUrl = version.FileUrl,
            GitHubUrl = version.GitHubUrl,
            GitHubBranch = version.GitHubBranch,
            Message = version.Message,
            Status = version.Status,
            SupervisorComment = version.SupervisorComment,
            SubmittedAt = version.SubmittedAt,
            ValidatedAt = version.ValidatedAt,
            SubmittedBy = version.SubmittedByUserId.HasValue
                ? new DeliverableVersionSubmittedByResponse
                {
                    Id = version.SubmittedByUserId.Value,
                    Name = submittedByUser is null
                        ? string.Empty
                        : $"{submittedByUser.FirstName} {submittedByUser.LastName}".Trim(),
                    Email = submittedByUser?.Email ?? string.Empty
                }
                : null
        };
    }

    private static string? ValidateSubmissionFile(IFormFile file)
    {
        if (file.Length == 0)
        {
            return "File is required.";
        }

        if (file.Length > MaxUploadBytes)
        {
            return "File exceeds the 10 MB limit.";
        }

        var fileExtension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(fileExtension) || !AllowedExtensions.Contains(fileExtension))
        {
            return "File extension is not allowed.";
        }

        if (string.IsNullOrWhiteSpace(file.ContentType) || !AllowedMimeTypes.Contains(file.ContentType))
        {
            return "File content type is not allowed.";
        }

        return null;
    }

    private static bool IsRepoLevelGitHubUrl(string rawValue)
    {
        if (!Uri.TryCreate(rawValue, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme is not "https" and not "http")
        {
            return false;
        }

        if (!string.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(uri.Query) || !string.IsNullOrWhiteSpace(uri.Fragment))
        {
            return false;
        }

        var pathSegments = uri.AbsolutePath
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (pathSegments.Length != 2)
        {
            return false;
        }

        return pathSegments.All(segment =>
            segment.Length > 0 &&
            segment.All(character =>
                char.IsAsciiLetterOrDigit(character) ||
                character is '-' or '_' or '.'));
    }

    private static bool IsActiveMission(Mission mission)
    {
        return string.Equals(mission.Status, DomainStatuses.Mission.Active, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsSubmittableStatus(string rawStatus)
    {
        var status = rawStatus.Trim().ToLowerInvariant();

        return status is
            DomainStatuses.Deliverable.Draft or
            DomainStatuses.Deliverable.InProgress or
            DomainStatuses.Deliverable.ChangesRequested or
            DomainStatuses.Deliverable.Pending or
            DomainStatuses.Deliverable.Rejected;
    }

    private static bool IsAwaitingReviewStatus(string rawStatus)
    {
        var status = rawStatus.Trim().ToLowerInvariant();

        return status is DomainStatuses.Deliverable.AwaitingReview or DomainStatuses.Deliverable.Submitted;
    }

    private static bool IsApprovedStatus(string rawStatus)
    {
        var status = rawStatus.Trim().ToLowerInvariant();

        return status is DomainStatuses.Deliverable.Approved or DomainStatuses.Deliverable.Accepted;
    }

    private static int ComputeNextVersionNumber(Deliverable deliverable, int? latestVersionNumber)
    {
        if (latestVersionNumber.HasValue)
        {
            return Math.Max(latestVersionNumber.Value, deliverable.Version) + 1;
        }

        var hasLegacySubmission =
            deliverable.SubmittedDate.HasValue ||
            !string.IsNullOrWhiteSpace(deliverable.FileUrl) ||
            !string.Equals(deliverable.Status, DomainStatuses.Deliverable.Pending, StringComparison.OrdinalIgnoreCase);

        return hasLegacySubmission
            ? Math.Max(deliverable.Version + 1, 2)
            : 1;
    }

    private static string? NormalizeOptionalText(string? rawValue)
    {
        return string.IsNullOrWhiteSpace(rawValue)
            ? null
            : rawValue.Trim();
    }

    private static string NormalizeStatusForIntern(string rawStatus)
    {
        var normalizedStatus = rawStatus.Trim().ToLowerInvariant();

        return normalizedStatus switch
        {
            DomainStatuses.Deliverable.Pending => DomainStatuses.Deliverable.Draft,
            DomainStatuses.Deliverable.Submitted => DomainStatuses.Deliverable.AwaitingReview,
            DomainStatuses.Deliverable.Accepted => DomainStatuses.Deliverable.Approved,
            DomainStatuses.Deliverable.Rejected => DomainStatuses.Deliverable.ChangesRequested,
            _ => normalizedStatus
        };
    }

}
public sealed class SubmitDeliverableVersionForm
{
    public IFormFile? File { get; init; }

    public long RowVersion { get; set; }

    public string? GitHubUrl { get; init; }

    public string? GitHubBranch { get; init; }

    public string? Message { get; init; }
}

public sealed class DeliverableVersionHistoryResponse
{
    public DeliverableVersionParentSummaryResponse Deliverable { get; init; } = new();

    public IReadOnlyList<DeliverableVersionResponse> Versions { get; init; } = Array.Empty<DeliverableVersionResponse>();
}

public sealed class DeliverableVersionParentSummaryResponse
{
    public Guid Id { get; init; }

    public Guid MissionId { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public int Version { get; init; }

    public int Progress { get; init; }

    public DateTime? DueDate { get; init; }

    public DateTime? SubmittedDate { get; init; }

    public string? SupervisorComment { get; init; }
}

public sealed class DeliverableVersionResponse
{
    public Guid Id { get; init; }

    public Guid DeliverableId { get; init; }

    public int VersionNumber { get; init; }

    public bool IsCurrentVersion { get; init; }

    public string? FileUrl { get; init; }

    public string? GitHubUrl { get; init; }

    public string? GitHubBranch { get; init; }

    public string? Message { get; init; }

    public string Status { get; init; } = string.Empty;

    public string? SupervisorComment { get; init; }

    public DateTime SubmittedAt { get; init; }

    public DateTime? ValidatedAt { get; init; }

    public DeliverableVersionSubmittedByResponse? SubmittedBy { get; init; }
}

public sealed class DeliverableVersionSubmittedByResponse
{
    public Guid Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;
}

public sealed class AssignDeliverableRequest
{
    public Guid InternId { get; init; }

    public Guid MissionId { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Description { get; init; }

    public DateTime? DueDate { get; init; }
}
