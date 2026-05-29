using System.Data;
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

        var data = await query
            .OrderBy(deliverable => deliverable.DueDate)
            .ThenByDescending(deliverable => deliverable.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(deliverable => new
            {
                id = deliverable.Id,
                title = deliverable.Title,
                dueDate = deliverable.DueDate,
                status = NormalizeStatusForIntern(deliverable.Status),
                version = deliverable.Version,
                supervisorComment = deliverable.SupervisorComment,
                progress = Math.Clamp(deliverable.Progress, 0, 100)
            })
            .ToListAsync(cancellationToken);

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

        if (deliverable.Mission is null || !IsActiveMission(deliverable.Mission))
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Deliverable is not associated with an active mission." });
        }

        var belongsToCurrentInternMission = deliverable.Mission.InternId == internId.Value ||
            await dbContext.MissionInternAssignments
                .AsNoTracking()
                .AnyAsync(
                    assignment => assignment.MissionId == deliverable.MissionId && assignment.InternId == internId.Value,
                    cancellationToken);

        if (!belongsToCurrentInternMission)
        {
            return Forbid();
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

        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction = null;
        try
        {
            if (dbContext.Database.IsRelational())
            {
                transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            }

            var latestVersionNumber = await dbContext.DeliverableVersions
                .AsNoTracking()
                .Where(version => version.DeliverableId == deliverable.Id)
                .Select(version => (int?)version.VersionNumber)
                .MaxAsync(cancellationToken);

            var nextVersionNumber = ComputeNextVersionNumber(deliverable, latestVersionNumber);
            var submittedAt = DateTime.UtcNow;

            var version = new DeliverableVersion
            {
                Id = Guid.NewGuid(),
                DeliverableId = deliverable.Id,
                VersionNumber = nextVersionNumber,
                FileUrl = storedFile?.Url,
                GitHubUrl = normalizedGitHubUrl,
                GitHubBranch = normalizedGitHubBranch,
                Message = normalizedMessage,
                Status = DomainStatuses.Deliverable.Submitted,
                SupervisorComment = null,
                SubmittedAt = submittedAt,
                SubmittedByUserId = intern.Id
            };

            dbContext.DeliverableVersions.Add(version);

            deliverable.Version = nextVersionNumber;
            deliverable.FileUrl = storedFile?.Url ?? string.Empty;
            deliverable.SubmittedDate = submittedAt;
            deliverable.Status = DomainStatuses.Deliverable.Submitted;
            deliverable.SupervisorComment = null;

            var linkedTasks = await dbContext.InternTasks
                .Where(task => task.DeliverableId == deliverable.Id && task.InternId == internId.Value)
                .ToListAsync(cancellationToken);

            foreach (var task in linkedTasks)
            {
                task.IsComplete = true;
                task.CompletedAt = submittedAt;
            }

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
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
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
            .FirstOrDefaultAsync(item => item.Id == deliverableId, cancellationToken);

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
                Status = deliverable.Status,
                Version = deliverable.Version,
                Progress = deliverable.Progress,
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
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitDeliverable(
        Guid id,
        [FromForm] SubmitDeliverableForm request,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new { message = "File is required." });
        }

        if (request.File.Length > MaxUploadBytes)
        {
            return BadRequest(new { message = "File exceeds the 10 MB limit." });
        }

        var fileExtension = Path.GetExtension(request.File.FileName);
        if (string.IsNullOrWhiteSpace(fileExtension) || !AllowedExtensions.Contains(fileExtension))
        {
            return BadRequest(new { message = "File extension is not allowed." });
        }

        if (string.IsNullOrWhiteSpace(request.File.ContentType) || !AllowedMimeTypes.Contains(request.File.ContentType))
        {
            return BadRequest(new { message = "File content type is not allowed." });
        }

        var deliverable = await dbContext.Deliverables
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

var uploadsDirectory = Path.Combine(environment.ContentRootPath, "uploads", "deliverables");
 Directory.CreateDirectory(uploadsDirectory);

 var storedFileName = $"{deliverable.Id}_{Guid.NewGuid():N}{fileExtension}";
 var destinationPath = Path.Combine(uploadsDirectory, storedFileName);

 var latestVersionNumber = await dbContext.DeliverableVersions
            .AsNoTracking()
            .Where(version => version.DeliverableId == deliverable.Id)
            .Select(version => (int?)version.VersionNumber)
            .MaxAsync(cancellationToken) ?? 0;

        var hadPreviousSubmission = deliverable.SubmittedDate.HasValue || !string.IsNullOrWhiteSpace(deliverable.FileUrl);
        var nextVersionNumber = hadPreviousSubmission
            ? Math.Max(Math.Max(1, deliverable.Version) + 1, latestVersionNumber + 1)
            : Math.Max(Math.Max(1, deliverable.Version), latestVersionNumber + 1);

        dbContext.DeliverableVersions.Add(new DeliverableVersion
        {
            Id = Guid.NewGuid(),
            DeliverableId = deliverable.Id,
            VersionNumber = nextVersionNumber,
            FileUrl = $"/uploads/deliverables/{storedFileName}".Replace('\\', '/'),
            Status = DomainStatuses.Deliverable.Submitted,
            SupervisorComment = null,
            SubmittedAt = DateTime.UtcNow,
            SubmittedByUserId = internId.Value
        });

        deliverable.Version = nextVersionNumber;
        deliverable.FileUrl = $"/uploads/deliverables/{storedFileName}".Replace('\\', '/');
        deliverable.SubmittedDate = DateTime.UtcNow;
        deliverable.Status = DomainStatuses.Deliverable.Submitted;
        deliverable.SupervisorComment = null;

        var linkedTasks = await dbContext.InternTasks
            .Where(task => task.DeliverableId == deliverable.Id && task.InternId == internId.Value)
            .ToListAsync(cancellationToken);

        foreach (var task in linkedTasks)
        {
            task.IsComplete = true;
            task.CompletedAt = DateTime.UtcNow;
        }

dbContext.AuditLogs.Add(new AuditLog
 {
 ActorUserId = internId,
 Actor = UserContextHelper.ResolveCurrentActorName(User),
 Action = "deliverable.submit",
 Entity = $"deliverable:{deliverable.Id}",
 Timestamp = DateTime.UtcNow
 });

 var tempPath = Path.Combine(uploadsDirectory, $"{Guid.NewGuid():N}.tmp");
 await using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
 {
 await request.File.CopyToAsync(stream, cancellationToken);
 }

 await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
 try
 {
 await dbContext.SaveChangesAsync(cancellationToken);
 // FIX C4: move file before committing DB changes.
 System.IO.File.Move(tempPath, destinationPath, overwrite: true);
 await transaction.CommitAsync(cancellationToken);
 }
 catch
 {
 // Best-effort cleanup: each step is wrapped in its own try/catch
 // so that a cleanup failure never masks the original exception.
 try
 {
 await transaction.RollbackAsync(cancellationToken);
 }
 catch (Exception rollbackEx)
 {
 logger.LogWarning(rollbackEx, "Transaction rollback failed after original error");
 }

 // FIX C4: remove any moved file on rollback to avoid orphaned blobs.
 try
 {
 if (System.IO.File.Exists(destinationPath))
 {
 System.IO.File.Delete(destinationPath);
 }
 }
 catch (Exception cleanupEx)
 {
 logger.LogWarning(cleanupEx, "Failed to delete destination file after error");
 }

 try
 {
 if (System.IO.File.Exists(tempPath))
 {
 System.IO.File.Delete(tempPath);
 }
 }
 catch (Exception cleanupEx)
 {
 logger.LogWarning(cleanupEx, "Failed to delete temp file after error");
 }

 throw;
 }
 finally
 {
 try
 {
 if (System.IO.File.Exists(tempPath))
 {
 System.IO.File.Delete(tempPath);
 }
 }
 catch (Exception cleanupEx)
 {
 logger.LogWarning(cleanupEx, "Failed to clean up temp file in finally block");
 }
 }

        var result = new
        {
            id = deliverable.Id,
            version = deliverable.Version,
            status = DomainStatuses.Deliverable.Submitted
        };

        return Created($"/api/deliverables/{deliverable.Id}", result);
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
    [HttpPatch("/api/intern/me/deliverables/{id:guid}/progress", Name = "UpdateDeliverableProgress")]
    [FeatureCard(DashboardCard.Deliverables)]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Intern")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDeliverableProgress(
        Guid id,
        [FromBody] UpdateDeliverableProgressRequest request,
        CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        if (request.Progress < 0 || request.Progress > 100)
        {
            return BadRequest(new { message = "progress must be between 0 and 100." });
        }

        var deliverable = await dbContext.Deliverables
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (deliverable is null)
        {
            return NotFound(new { message = "Deliverable not found." });
        }

        deliverable.Progress = request.Progress;

        var linkedTasks = await dbContext.InternTasks
            .Where(task => task.DeliverableId == deliverable.Id && task.InternId == internId.Value)
            .ToListAsync(cancellationToken);

        foreach (var task in linkedTasks)
        {
            var isComplete = request.Progress >= 100;
            task.IsComplete = isComplete;
            task.CompletedAt = isComplete ? DateTime.UtcNow : null;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "deliverable.progress.update",
            Entity = $"deliverable:{deliverable.Id} progress:{deliverable.Progress}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = deliverable.Id,
            progress = deliverable.Progress
        });
    }

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
    /// <response code="409">Livrable pas encore soumis.</response>
    [HttpPatch("{id:guid}/validate", Name = "ValidateDeliverable")]
    // RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ValidateDeliverable(
        Guid id,
        [FromBody] ValidateDeliverableRequest request,
        CancellationToken cancellationToken)
    {
        var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentSupervisorId.HasValue)
        {
            return Unauthorized();
        }

        try
        {
            var response = await deliverablesService.ValidateDeliverableAsync(
                currentSupervisorId.Value,
                id,
                request.Status,
                request.Action,
                request.Comment,
                UserContextHelper.ResolveCurrentActorName(User),
                cancellationToken);

            return Ok(response);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = exception.Message });
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

        var missionExists = await dbContext.Missions
            .AsNoTracking()
            .AnyAsync(mission => mission.Id == request.MissionId && mission.SupervisorId == supervisorId.Value, cancellationToken);

        if (!missionExists)
        {
            return BadRequest(new { message = "Mission not found for current supervisor." });
        }

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
    Progress = 0,
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
            progress = deliverable.Progress
        });
    }

    private static DeliverableVersionResponse ToVersionResponse(DeliverableVersion version, User? submittedByUser)
    {
        return new DeliverableVersionResponse
        {
            Id = version.Id,
            DeliverableId = version.DeliverableId,
            VersionNumber = version.VersionNumber,
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
            DomainStatuses.Deliverable.Pending => "not_submitted",
            DomainStatuses.Deliverable.Submitted => DomainStatuses.Deliverable.Submitted,
            DomainStatuses.Deliverable.Accepted => DomainStatuses.Deliverable.Accepted,
            DomainStatuses.Deliverable.Rejected => DomainStatuses.Deliverable.Rejected,
            _ => normalizedStatus
        };
    }

}

public sealed class ValidateDeliverableRequest
{
    public string? Status { get; init; }

    public string? Action { get; init; }

    public string? Comment { get; init; }
}

public sealed class SubmitDeliverableForm
{
    public IFormFile? File { get; init; }
}

public sealed class SubmitDeliverableVersionForm
{
    public IFormFile? File { get; init; }

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

public sealed class UpdateDeliverableProgressRequest
{
    public int Progress { get; init; }
}

public sealed class AssignDeliverableRequest
{
    public Guid InternId { get; init; }

    public Guid MissionId { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Description { get; init; }

    public DateTime? DueDate { get; init; }
}
