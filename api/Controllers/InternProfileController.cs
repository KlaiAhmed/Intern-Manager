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
using System.Text.RegularExpressions;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion du profil stagiaire.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
/// <param name="environment">Environnement d hébergement pour accéder aux fichiers.</param>
/// <param name="notificationService">Service de notifications in-app.</param>
/// <param name="internSkillsService">Service de gestion des compétences du stagiaire.</param>
[ApiController]
[Route("api/intern/me/profile")]
// RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
[Authorize(Roles = "SuperAdmin,Admin,Intern")]
public sealed class InternProfileController(
    AppDbContext dbContext,
    IWebHostEnvironment environment,
    INotificationService notificationService,
    IInternSkillsService internSkillsService) : ControllerBase
{
    private const long MaxCvUploadBytes = 2 * 1024 * 1024;
    private static readonly Regex PhoneNumberRegex = new(@"^\+?[0-9][0-9\s().-]{6,19}$", RegexOptions.Compiled);

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

        var intern = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
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

        return Ok(ToProfileResponse(profile, intern.VerificationStatus, skills));
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
    [ProducesResponseType(StatusCodes.Status423Locked)]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateInternProfileRequest request, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var intern = await dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var pendingLockResult = EnforcePendingLock(intern);
        if (pendingLockResult is not null)
        {
            return pendingLockResult;
        }

        var profile = await EnsureProfileAsync(internId.Value, cancellationToken);

        if (request.UniversityId.HasValue)
        {
            var schoolExists = await dbContext.Schools
                .AsNoTracking()
                .AnyAsync(school => school.Id == request.UniversityId.Value, cancellationToken);

            if (!schoolExists)
            {
                return BadRequest(new { message = "Selected university is not valid." });
            }

            profile.UniversityId = request.UniversityId.Value;
        }

        if (request.Major is not null)
        {
            var normalizedMajor = request.Major.Trim();
            if (normalizedMajor.Length > 200)
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["major"] = "Major cannot exceed 200 characters."
                });
            }

            profile.Major = normalizedMajor;
        }

        if (request.CurrentYearOfStudy is not null)
        {
            var normalizedCurrentYearOfStudy = request.CurrentYearOfStudy.Trim();
            if (normalizedCurrentYearOfStudy.Length > 64)
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["currentYearOfStudy"] = "Current year of study cannot exceed 64 characters."
                });
            }

            profile.CurrentYearOfStudy = normalizedCurrentYearOfStudy;
        }

        if (request.ExpectedGraduationDate.HasValue)
        {
            profile.ExpectedGraduationDate = request.ExpectedGraduationDate.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.WorkPreference))
        {
            if (!TryParseWorkPreference(request.WorkPreference, out var workPreference))
            {
                return BadRequest(new { message = "Invalid workPreference. Allowed values: remote, hybrid, onsite." });
            }

            profile.WorkPreference = workPreference;
        }

        if (request.PhoneNumber is not null)
        {
            var normalizedPhoneNumber = NormalizePhoneNumber(request.PhoneNumber);

            if (!string.IsNullOrWhiteSpace(normalizedPhoneNumber) && !IsValidPhoneNumber(normalizedPhoneNumber))
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["phoneNumber"] = "Phone number format is invalid."
                });
            }

            profile.PhoneNumber = normalizedPhoneNumber;
        }

        if (request.StartDate.HasValue)
        {
            profile.StartDate = request.StartDate.Value;
        }

        if (request.EndDate.HasValue)
        {
            profile.EndDate = request.EndDate.Value;
        }

        if (profile.StartDate.HasValue && profile.EndDate.HasValue && profile.EndDate.Value <= profile.StartDate.Value)
        {
            return BadRequest(new { message = "endDate must be greater than startDate." });
        }

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

        return Ok(ToProfileResponse(profile, intern.VerificationStatus, skills));
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

        var intern = await dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var pendingLockResult = EnforcePendingLock(intern);
        if (pendingLockResult is not null)
        {
            return pendingLockResult;
        }

        try
        {
            var skills = await internSkillsService.ReplaceSkillsAsync(
                internId.Value,
                request.SkillIds,
                internId,
                UserContextHelper.ResolveCurrentActorName(User),
                cancellationToken);

            return Ok(new { data = skills });
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    /// <summary>
    /// Télécharge le CV du stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de télécharger son CV au format PDF.
    /// Le fichier ne doit pas dépasser 2 Mo. L ancien CV est automatiquement
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

        var intern = await dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        var pendingLockResult = EnforcePendingLock(intern);
        if (pendingLockResult is not null)
        {
            return pendingLockResult;
        }

        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new { message = "File is required." });
        }

        if (request.File.Length > MaxCvUploadBytes)
        {
            return BadRequest(new { message = "CV exceeds the 2 MB limit." });
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

        if (!HasValidPdfSignature(request.File))
        {
            return BadRequest(new { message = "CV must be a valid PDF file." });
        }

        var profile = await EnsureProfileAsync(internId.Value, cancellationToken);

        if (intern.VerificationStatus == InternVerificationStatus.ACTIVE)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = $"CV upload is not allowed when intern status is {intern.VerificationStatus}." });
        }

        var uploadsDirectory = Path.Combine(environment.ContentRootPath, "uploads", "cv");
        Directory.CreateDirectory(uploadsDirectory);

        var oldCvFileUrl = profile.CvFileUrl;
        var oldFilePath = ResolveStoredFilePath(oldCvFileUrl, uploadsDirectory);

        var storedFileName = $"{internId.Value}_{DateTime.UtcNow:yyyyMMddHHmmssfff}.pdf";
        var finalPath = Path.Combine(uploadsDirectory, storedFileName);
        var tempPath = Path.Combine(uploadsDirectory, $"{Guid.NewGuid():N}.tmp");

        await using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await request.File.CopyToAsync(stream, cancellationToken);
        }

        profile.CvFileUrl = $"/uploads/cv/{storedFileName}";

        profile.StartDate = null;
        profile.EndDate = null;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "intern.profile.cv.upload",
            Entity = $"intern:{internId.Value}",
            Timestamp = DateTime.UtcNow
        });

        notificationService.QueueNotification(
            internId.Value,
            "intern.cv.submitted",
            "CV submitted",
            "Your CV has been submitted successfully. You will be notified when a supervisor assigns you to a project.",
            $"intern:{internId.Value}");

        notificationService.QueueNotification(
            internId.Value,
            "intern.profile.pending-assignment",
            "Profile awaiting assignment",
            "Your profile is awaiting assignment",
            $"intern:{internId.Value}");

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);

            System.IO.File.Move(tempPath, finalPath, overwrite: true);

            if (!string.IsNullOrWhiteSpace(oldFilePath) &&
                !string.Equals(oldFilePath, finalPath, StringComparison.OrdinalIgnoreCase) &&
                System.IO.File.Exists(oldFilePath))
            {
                System.IO.File.Delete(oldFilePath);
            }
        }
        catch
        {
            if (System.IO.File.Exists(tempPath))
            {
                System.IO.File.Delete(tempPath);
            }

            throw;
        }

        return Ok(new
        {
            fileUrl = profile.CvFileUrl,
            status = intern.VerificationStatus.ToString(),
            verificationStatus = intern.VerificationStatus.ToString()
        });
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
            UniversityId = null,
            Major = string.Empty,
            CurrentYearOfStudy = string.Empty,
            ExpectedGraduationDate = null,
            WorkPreference = null,
            PhoneNumber = null,
            CvFileUrl = null,
            StartDate = null,
            EndDate = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.InternProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return profile;
    }

    private static object ToProfileResponse(InternProfile profile, InternVerificationStatus verificationStatus, IEnumerable<object> skills)
    {
        return new
        {
            id = profile.Id,
            universityId = profile.UniversityId,
            major = profile.Major,
            currentYearOfStudy = profile.CurrentYearOfStudy,
            expectedGraduationDate = profile.ExpectedGraduationDate,
            workPreference = profile.WorkPreference?.ToString().ToLowerInvariant(),
            phoneNumber = profile.PhoneNumber,
            cvFileUrl = profile.CvFileUrl,
            status = verificationStatus.ToString(),
            verificationStatus = verificationStatus.ToString(),
            startDate = profile.StartDate,
            endDate = profile.EndDate,
            skills
        };
    }

    private static bool TryParseWorkPreference(string rawValue, out WorkPreference workPreference)
    {
        workPreference = default;

        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return false;
        }

        return Enum.TryParse(rawValue.Trim(), ignoreCase: true, out workPreference);
    }

    private static string? NormalizePhoneNumber(string? rawValue)
    {
        return string.IsNullOrWhiteSpace(rawValue)
            ? null
            : rawValue.Trim();
    }

    private static bool IsValidPhoneNumber(string rawValue)
    {
        return PhoneNumberRegex.IsMatch(rawValue);
    }

  /// <summary>
  /// Récupère la liste des écoles/universités disponibles pour le formulaire d onboarding.
  /// </summary>
  /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
  /// <returns>Une liste d écoles.</returns>
  /// <response code="200">Liste récupérée avec succès.</response>
  /// <response code="401">Utilisateur non connecté.</response>
  [HttpGet("schools", Name = "GetSchoolsForIntern")]
  [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
  [ProducesResponseType(StatusCodes.Status401Unauthorized)]
  public async Task<IActionResult> GetSchools(CancellationToken cancellationToken)
  {
    var schools = await dbContext.Schools
      .AsNoTracking()
      .OrderBy(school => school.Name)
      .Select(school => new ReferentialResponse
      {
        Id = school.Id,
        Name = school.Name
      })
      .ToListAsync(cancellationToken);

    return Ok(schools);
  }

    private static IActionResult? EnforcePendingLock(User intern)
    {
        if (intern.VerificationStatus != InternVerificationStatus.PENDING)
        {
            return null;
        }

        return new ObjectResult(new
        {
            message = "Profile is locked while your verification is pending."
        })
        {
            StatusCode = StatusCodes.Status423Locked
        };
    }

    private static bool HasValidPdfSignature(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        var header = new byte[5];
        var bytesRead = stream.Read(header, 0, header.Length);

        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        return bytesRead == 5 &&
               header[0] == 0x25 && // %
               header[1] == 0x50 && // P
               header[2] == 0x44 && // D
               header[3] == 0x46 && // F
               header[4] == 0x2D;   // -
    }

    private static string? ResolveStoredFilePath(string? cvFileUrl, string uploadsDirectory)
    {
        if (string.IsNullOrWhiteSpace(cvFileUrl))
        {
            return null;
        }

        var fileName = Path.GetFileName(cvFileUrl);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        return Path.Combine(uploadsDirectory, fileName);
    }
}

public sealed class UpdateInternProfileRequest
{
    public Guid? UniversityId { get; init; }

    public string? Major { get; init; }

    public string? CurrentYearOfStudy { get; init; }

    public DateTime? ExpectedGraduationDate { get; init; }

    public DateTime? StartDate { get; init; }

    public DateTime? EndDate { get; init; }

    public string? WorkPreference { get; init; }

    public string? PhoneNumber { get; init; }
}

public sealed class UpdateInternSkillsRequest
{
    public Guid[] SkillIds { get; init; } = Array.Empty<Guid>();
}

public sealed class UploadInternCvForm
{
    public IFormFile? File { get; init; }
}
