using InternManager.Api.Common.Constants;
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
/// <param name="deliverablesService">Service métier des livrables.</param>
[ApiController]
[Route("api/deliverables")]
[Authorize]
public sealed class DeliverablesController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    IDeliverablesService deliverablesService) : ControllerBase
{
    private const long MaxUploadBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".doc",
        ".docx",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg"
    };

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "image/png",
        "image/jpeg"
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
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListDeliverables")]
    [Authorize(Roles = "Supervisor")]
    [ProducesResponseType(typeof(PagedResponse<DeliverableQueueItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDeliverables(
        [FromQuery] string? status = null,
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

        var response = await deliverablesService.GetSupervisorDeliverablesAsync(
            currentSupervisorId.Value,
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
    [Authorize(Roles = "Intern")]
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
    [Authorize(Roles = "Intern")]
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

        var storedFileName = $"{deliverable.Id}_{DateTime.UtcNow:yyyyMMddHHmmssfff}{fileExtension}";
        var destinationPath = Path.Combine(uploadsDirectory, storedFileName);
        var tempPath = Path.Combine(uploadsDirectory, $"{Guid.NewGuid():N}.tmp");

        await using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await request.File.CopyToAsync(stream, cancellationToken);
        }

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
            SubmittedAt = DateTime.UtcNow
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

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            System.IO.File.Move(tempPath, destinationPath, overwrite: true);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);

            if (System.IO.File.Exists(tempPath))
            {
                System.IO.File.Delete(tempPath);
            }

            throw;
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
    [Authorize(Roles = "Intern")]
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
    [Authorize(Roles = "Supervisor")]
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

public sealed class UpdateDeliverableProgressRequest
{
    public int Progress { get; init; }
}
