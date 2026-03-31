using System.Text.Json;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion du profil stagiaire.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="environment">Environnement d hébergement pour accéder aux fichiers.</param>
[ApiController]
[Route("api/intern/me/profile")]
[Authorize(Roles = "Intern")]
public sealed class InternProfileController(AppDbContext dbContext, IWebHostEnvironment environment) : ControllerBase
{
    private const long MaxCvUploadBytes = 5 * 1024 * 1024;

    /// <summary>
    /// Récupère le profil du stagiaire connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les informations du profil stagiaire de l utilisateur connecté.
    /// Cela inclut l école, la spécialité, les compétences, l expérience et le CV.
    /// Si le profil n existe pas encore, un profil vide est créé automatiquement.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du profil stagiaire.</returns>
    /// <response code="200">Profil récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Stagiaire non trouvé.</response>
    [HttpGet(Name = "GetMyInternProfile")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyProfile(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var isIntern = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (!isIntern)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var profile = await EnsureProfileAsync(internId.Value, cancellationToken);

        var skills = await dbContext.InternProfileSkills
            .AsNoTracking()
            .Where(item => item.InternProfileId == profile.Id)
            .Include(item => item.Skill)
            .OrderBy(item => item.Skill!.Name)
            .Select(item => new
            {
                id = item.SkillId,
                name = item.Skill != null ? item.Skill.Name : string.Empty
            })
            .ToListAsync(cancellationToken);

        return Ok(ToProfileResponse(profile, skills));
    }

    /// <summary>
    /// Met à jour les informations du profil stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de modifier son école, sa spécialité,
    /// son expérience et ses compétences. Seuls les champs fournis sont mis à jour.
    /// </remarks>
    /// <param name="request">Objet contenant les informations à mettre à jour.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le profil mis à jour.</returns>
    /// <response code="200">Profil mis à jour avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    [HttpPatch(Name = "UpdateMyInternProfile")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateInternProfileRequest request, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var profile = await EnsureProfileAsync(internId.Value, cancellationToken);

        profile.School = (request.School ?? string.Empty).Trim();
        profile.Specialty = (request.Specialty ?? string.Empty).Trim();
        profile.Experience = (request.Experience ?? string.Empty).Trim();

        var normalizedCompetencies = (request.Competencies ?? Array.Empty<string>())
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        profile.CompetenciesJson = JsonSerializer.Serialize(normalizedCompetencies);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "intern.profile.update",
            Entity = $"intern:{internId.Value}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var skills = await dbContext.InternProfileSkills
            .AsNoTracking()
            .Where(item => item.InternProfileId == profile.Id)
            .Include(item => item.Skill)
            .OrderBy(item => item.Skill!.Name)
            .Select(item => new
            {
                id = item.SkillId,
                name = item.Skill != null ? item.Skill.Name : string.Empty
            })
            .ToListAsync(cancellationToken);

        return Ok(ToProfileResponse(profile, skills));
    }

    /// <summary>
    /// Remplace la liste des compétences du stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route remplace entièrement la liste des compétences associées au profil.
    /// Les compétences doivent correspondre à des identifiants existants dans le référentiel.
    /// Les anciennes compétences non présentes dans la nouvelle liste seront supprimées.
    /// </remarks>
    /// <param name="request">Objet contenant la liste des identifiants de compétences.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>La nouvelle liste de compétences.</returns>
    /// <response code="200">Compétences mises à jour avec succès.</response>
    /// <response code="400">Identifiants de compétences invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    [HttpPut("skills", Name = "ReplaceMyInternSkills")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ReplaceSkills([FromBody] UpdateInternSkillsRequest request, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var profile = await EnsureProfileAsync(internId.Value, cancellationToken);

        var requestedSkillIds = (request.SkillIds ?? Array.Empty<Guid>())
            .Where(value => value != Guid.Empty)
            .Distinct()
            .ToHashSet();

        if (requestedSkillIds.Count > 0)
        {
            var existingSkillIds = await dbContext.Skills
                .AsNoTracking()
                .Where(skill => requestedSkillIds.Contains(skill.Id))
                .Select(skill => skill.Id)
                .ToListAsync(cancellationToken);

            if (existingSkillIds.Count != requestedSkillIds.Count)
            {
                return BadRequest(new { message = "One or more skill ids are invalid." });
            }
        }

        var currentLinks = await dbContext.InternProfileSkills
            .Where(item => item.InternProfileId == profile.Id)
            .ToListAsync(cancellationToken);

        var linksToRemove = currentLinks
            .Where(link => !requestedSkillIds.Contains(link.SkillId))
            .ToList();

        if (linksToRemove.Count > 0)
        {
            dbContext.InternProfileSkills.RemoveRange(linksToRemove);
        }

        var currentSkillIds = currentLinks.Select(link => link.SkillId).ToHashSet();

        var linksToAdd = requestedSkillIds
            .Where(skillId => !currentSkillIds.Contains(skillId))
            .Select(skillId => new InternProfileSkill
            {
                InternProfileId = profile.Id,
                SkillId = skillId,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (linksToAdd.Count > 0)
        {
            dbContext.InternProfileSkills.AddRange(linksToAdd);
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "intern.profile.skills.replace",
            Entity = $"intern:{internId.Value} count:{requestedSkillIds.Count}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var skills = await dbContext.InternProfileSkills
            .AsNoTracking()
            .Where(item => item.InternProfileId == profile.Id)
            .Include(item => item.Skill)
            .OrderBy(item => item.Skill!.Name)
            .Select(item => new
            {
                id = item.SkillId,
                name = item.Skill != null ? item.Skill.Name : string.Empty
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data = skills });
    }

    /// <summary>
    /// Télécharge le CV du stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de télécharger son CV au format PDF.
    /// Le fichier ne doit pas dépasser 5 Mo. L ancien CV est automatiquement
    /// remplacé par le nouveau.
    /// </remarks>
    /// <param name="request">Objet contenant le fichier PDF à télécharger.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>L URL du fichier téléchargé.</returns>
    /// <response code="200">CV téléchargé avec succès.</response>
    /// <response code="400">Fichier invalide ou trop volumineux.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    [HttpPost("cv", Name = "UploadMyInternCv")]
    [EnableRateLimiting("upload")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UploadCv([FromForm] UploadInternCvForm request, CancellationToken cancellationToken)
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

        if (request.File.Length > MaxCvUploadBytes)
        {
            return BadRequest(new { message = "CV exceeds the 5 MB limit." });
        }

        var extension = Path.GetExtension(request.File.FileName);
        if (!string.Equals(extension, ".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only PDF files are allowed." });
        }

        var contentType = request.File.ContentType?.Trim();
        if (!string.Equals(contentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Invalid CV content type." });
        }

        var profile = await EnsureProfileAsync(internId.Value, cancellationToken);

        var uploadsDirectory = Path.Combine(environment.ContentRootPath, "uploads", "cv");
        Directory.CreateDirectory(uploadsDirectory);

        if (!string.IsNullOrWhiteSpace(profile.CvFileUrl))
        {
            TryDeleteExistingFile(profile.CvFileUrl, uploadsDirectory);
        }

        var storedFileName = $"{internId.Value}_{DateTime.UtcNow:yyyyMMddHHmmssfff}.pdf";
        var destinationPath = Path.Combine(uploadsDirectory, storedFileName);

        await using (var stream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await request.File.CopyToAsync(stream, cancellationToken);
        }

        profile.CvFileUrl = $"/uploads/cv/{storedFileName}";

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "intern.profile.cv.upload",
            Entity = $"intern:{internId.Value}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { fileUrl = profile.CvFileUrl });
    }

    /// <summary>
    /// Télécharge le CV du stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route permet de récupérer le fichier CV précédemment téléchargé.
    /// Le fichier est retourné en tant que pièce jointe PDF.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le fichier CV en format PDF.</returns>
    /// <response code="200">Fichier retourné avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Aucun CV trouvé.</response>
    [HttpGet("cv", Name = "DownloadMyInternCv")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadCv(CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var profile = await dbContext.InternProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.InternId == internId.Value, cancellationToken);

        if (profile is null || string.IsNullOrWhiteSpace(profile.CvFileUrl))
        {
            return NotFound(new { message = "CV not found." });
        }

        var relativePath = profile.CvFileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(environment.ContentRootPath, relativePath);

        if (!System.IO.File.Exists(absolutePath))
        {
            return NotFound(new { message = "CV file is missing from storage." });
        }

        return PhysicalFile(absolutePath, "application/pdf", enableRangeProcessing: true);
    }

    private async Task<InternProfile> EnsureProfileAsync(Guid internId, CancellationToken cancellationToken)
    {
        var profile = await dbContext.InternProfiles
            .FirstOrDefaultAsync(item => item.InternId == internId, cancellationToken);

        if (profile is not null)
        {
            return profile;
        }

        profile = new InternProfile
        {
            Id = Guid.NewGuid(),
            InternId = internId,
            School = string.Empty,
            Specialty = string.Empty,
            CompetenciesJson = "[]",
            Experience = string.Empty,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.InternProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return profile;
    }

    private static object ToProfileResponse(InternProfile profile, IEnumerable<object> skills)
    {
        var competencies = ParseCompetencies(profile.CompetenciesJson);

        return new
        {
            id = profile.Id,
            school = profile.School,
            specialty = profile.Specialty,
            competencies,
            experience = profile.Experience,
            cvFileUrl = profile.CvFileUrl,
            skills
        };
    }

    private static IReadOnlyList<string> ParseCompetencies(string? rawCompetencies)
    {
        if (string.IsNullOrWhiteSpace(rawCompetencies))
        {
            return Array.Empty<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<string[]>(rawCompetencies) ?? Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static void TryDeleteExistingFile(string cvFileUrl, string uploadsDirectory)
    {
        var fileName = Path.GetFileName(cvFileUrl);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return;
        }

        var path = Path.Combine(uploadsDirectory, fileName);
        if (System.IO.File.Exists(path))
        {
            System.IO.File.Delete(path);
        }
    }
}

public sealed class UpdateInternProfileRequest
{
    public string School { get; init; } = string.Empty;

    public string Specialty { get; init; } = string.Empty;

    public string Experience { get; init; } = string.Empty;

    public string[] Competencies { get; init; } = Array.Empty<string>();
}

public sealed class UpdateInternSkillsRequest
{
    public Guid[] SkillIds { get; init; } = Array.Empty<Guid>();
}

public sealed class UploadInternCvForm
{
    public IFormFile? File { get; init; }
}
