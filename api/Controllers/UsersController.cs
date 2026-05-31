using InternManager.Api.Application.Users;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.DTOs.User;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des utilisateurs (liste, création, mise à jour).
/// </summary>
/// <param name="dbContext">Contexte EF Core pour manipuler les utilisateurs.</param>
/// <param name="deletionService">Service chargé de valider et d exécuter les suppressions utilisateur.</param>
[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController(AppDbContext dbContext, UserDeletionService deletionService) : ControllerBase
{
    /// <summary>
    /// Récupère la liste des utilisateurs avec des filtres optionnels.
    /// </summary>
    /// <remarks>
    /// Cette route retourne une liste paginée d utilisateurs. Vous pouvez filtrer par rôle, statut,
    /// département ou faire une recherche par nom/email. Seuls les administrateurs et les managers peuvent y accéder.
    /// Les résultats sont triés par date de création, du plus récent au plus ancien.
    /// </remarks>
    /// <param name="role">Filtre par rôle (ex: Intern, Supervisor, Admin).</param>
    /// <param name="page">Numéro de la page à récupérer (débute à 1).</param>
    /// <param name="limit">Nombre d éléments par page (entre 1 et 100).</param>
    /// <param name="status">Filtre par statut (active, archived).</param>
    /// <param name="department">Filtre par département (identifiant ou \"all\").</param>
    /// <param name="search">Texte à rechercher dans le nom, email ou département.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste paginée d utilisateurs.</returns>
    /// <response code="200">Liste récupérée avec succès.</response>
    /// <response code="400">Paramètres de filtre invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé (rôle insuffisant).</response>
    [HttpGet(Name = "ListUsers")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? role,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? status = null,
        [FromQuery] string? department = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        UserRole parsedRole = default;
        UserStatus parsedStatus = default;

        if (!string.IsNullOrWhiteSpace(role) && !TryParseRole(role, out parsedRole))
        {
            return BadRequest(new { message = "Invalid role filter." });
        }

        if (!string.IsNullOrWhiteSpace(status) && !TryParseStatus(status, out parsedStatus))
        {
            return BadRequest(new { message = "Invalid status filter." });
        }

        if (!TryParseDepartmentFilter(department, out var parsedDepartmentId))
        {
            return BadRequest(new { message = "Invalid department filter." });
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Users
            .AsNoTracking()
            .Include(user => user.Department)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(user => user.Role == parsedRole);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(user => user.Status == parsedStatus);
        }

        if (parsedDepartmentId.HasValue)
        {
            query = query.Where(user => user.DepartmentId == parsedDepartmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim();

            query = query.Where(user =>
                EF.Functions.Like(user.FirstName, $"%{normalizedSearch}%") ||
                EF.Functions.Like(user.LastName, $"%{normalizedSearch}%") ||
                EF.Functions.Like(user.Email, $"%{normalizedSearch}%") ||
                (user.Department != null && EF.Functions.Like(user.Department.Name, $"%{normalizedSearch}%")));
        }

        var total = await query.CountAsync(cancellationToken);

        var users = await query
            .OrderByDescending(user => user.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var data = users.Select(user => ToDashboardUser(user)).ToList();

        return Ok(new { data, total });
    }

    /// <summary>
    /// Crée un nouvel utilisateur dans le système.
    /// </summary>
    /// <remarks>
    /// Cette route crée un compte avec les informations fournies. L email doit être unique.
    /// Un mot de passe conforme à la politique de sécurité est obligatoire.
    /// Les administrateurs ne peuvent pas créer de comptes SuperAdmin.
    /// </remarks>
    /// <param name="request">Objet contenant les informations du nouvel utilisateur.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du compte créé.</returns>
    /// <response code="201">Utilisateur créé avec succès.</response>
    /// <response code="400">Données invalides ou incomplètes.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé (rôle insuffisant).</response>
    /// <response code="409">Un compte existe déjà avec cet email.</response>
    [HttpPost(Name = "CreateUser")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateUser([FromBody] UpsertUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Email is required." });
        }

        if (!TryResolveCreateNameParts(request, out var firstName, out var lastName))
        {
            return BadRequest(new { message = "FirstName/LastName or Name is required." });
        }

        if (!TryParseRole(request.Role, out var parsedRole))
        {
            return BadRequest(new { message = "Invalid role." });
        }

        var actorRole = UserContextHelper.ResolveCurrentUserRole(User);
        if (actorRole == UserRole.Admin && parsedRole == UserRole.SuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Admins cannot assign SuperAdmin role." });
        }

        if (!TryParseDepartmentRequest(request.Department, out var departmentId))
        {
            return BadRequest(new { message = "Invalid department." });
        }

        string? departmentName = null;
        if (departmentId.HasValue)
        {
            var departmentEntry = await dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == departmentId.Value, cancellationToken);

            if (departmentEntry is null)
            {
                return BadRequest(new { message = "Department not found." });
            }

            departmentName = departmentEntry.Name;
        }

        var email = NormalizeEmail(request.Email);

        var exists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => EF.Functions.Collate(user.Email, "SQL_Latin1_General_CP1_CI_AS") == email, cancellationToken);

        if (exists)
        {
            return Conflict(new { message = "A user with this email already exists." });
        }

        var effectivePassword = request.Password?.Trim() ?? string.Empty;

        if (!PasswordPolicyValidator.IsValid(effectivePassword))
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["password"] = PasswordPolicyValidator.ErrorMessage
            });
        }

        if (!TryParseStatus(request.Status, out var parsedStatus))
        {
            parsedStatus = UserStatus.Active;
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            PasswordHash = PasswordHasher.HashPassword(effectivePassword),
            Role = parsedRole,
            Status = parsedStatus,
            VerificationStatus = parsedRole == UserRole.Intern
                ? InternVerificationStatus.INCOMPLETE
                : InternVerificationStatus.NOT_APPLICABLE,
            DepartmentId = departmentId
        };

        dbContext.Users.Add(user);

        if (parsedRole == UserRole.Intern)
        {
            dbContext.InternProfiles.Add(new InternProfile
            {
                Id = Guid.NewGuid(),
                InternId = user.Id,
                UniversityId = null,
                Major = string.Empty,
                CurrentYearOfStudy = string.Empty,
                ExpectedGraduationDate = null,
                WorkPreference = null,
                CvFileUrl = null,
                StartDate = null,
                EndDate = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        var actorName = UserContextHelper.ResolveCurrentActorName(User);
        dbContext.AuditLogs.Add(CreateAuditLog(actorUserId, actorName, "user.create", $"user:{user.Id}"));

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = ToDashboardUser(user, departmentName);
        return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, result);
    }

    /// <summary>
    /// Met à jour les informations d un utilisateur.
    /// </summary>
    /// <remarks>
    /// Cette route permet de modifier certains champs d un compte existant.
    /// Vous pouvez changer le nom, email, rôle, statut, mot de passe ou département.
    /// Un utilisateur archivé ne peut être modifié que pour changer son statut.
    /// Les administrateurs ne peuvent pas modifier les comptes SuperAdmin.
    /// </remarks>
    /// <param name="id">Identifiant unique de l utilisateur à modifier.</param>
    /// <param name="request">Objet contenant les champs à mettre à jour.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations mises à jour de l utilisateur.</returns>
    /// <response code="200">Utilisateur mis à jour avec succès.</response>
    /// <response code="400">Données invalides.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Utilisateur non trouvé.</response>
    /// <response code="409">Conflit (email déjà utilisé ou utilisateur archivé).</response>
    [HttpPatch("{id:guid}", Name = "UpdateUser")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpsertUserRequest request, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .Include(current => current.Department)
            .FirstOrDefaultAsync(current => current.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        var updatesNonStatusField =
            !string.IsNullOrWhiteSpace(request.Name) ||
            !string.IsNullOrWhiteSpace(request.FirstName) ||
            !string.IsNullOrWhiteSpace(request.LastName) ||
            !string.IsNullOrWhiteSpace(request.Email) ||
            !string.IsNullOrWhiteSpace(request.Role) ||
            !string.IsNullOrWhiteSpace(request.Password) ||
            !string.IsNullOrWhiteSpace(request.Department);

        if (user.Status == UserStatus.Archived && updatesNonStatusField)
        {
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                message = "Archived users can only be reactivated through the status field."
            });
        }

        var updatedFields = new List<string>();
        var resolvedDepartmentName = user.Department?.Name;

        if (!string.IsNullOrWhiteSpace(request.Name) ||
            !string.IsNullOrWhiteSpace(request.FirstName) ||
            !string.IsNullOrWhiteSpace(request.LastName))
        {
            if (!TryResolveUpdateNameParts(request, user, out var firstName, out var lastName))
            {
                return BadRequest(new { message = "Invalid firstName/lastName values." });
            }

            user.FirstName = firstName;
            user.LastName = lastName;
            updatedFields.Add("name");
        }

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var email = NormalizeEmail(request.Email);

            var emailTaken = await dbContext.Users
                .AsNoTracking()
                .AnyAsync(current => current.Id != id &&
                                     EF.Functions.Collate(current.Email, "SQL_Latin1_General_CP1_CI_AS") == email,
                          cancellationToken);

            if (emailTaken)
            {
                return Conflict(new { message = "A user with this email already exists." });
            }

            user.Email = email;
            updatedFields.Add("email");
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            if (!TryParseRole(request.Role, out var parsedRole))
            {
                return BadRequest(new { message = "Invalid role." });
            }

            var actorRole = UserContextHelper.ResolveCurrentUserRole(User);
            if (actorRole == UserRole.Admin && parsedRole == UserRole.SuperAdmin)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Admins cannot assign SuperAdmin role." });
            }

            if (user.Role != parsedRole)
            {
                var previousRole = user.Role;
                user.Role = parsedRole;

                if (parsedRole != UserRole.Intern)
                {
                    user.VerificationStatus = InternVerificationStatus.NOT_APPLICABLE;
                }
                else if (previousRole != UserRole.Intern)
                {
                    user.VerificationStatus = InternVerificationStatus.INCOMPLETE;
                }

                updatedFields.Add("role");

                dbContext.AuditLogs.Add(CreateAuditLog(
                    UserContextHelper.ResolveCurrentUserId(User),
                    UserContextHelper.ResolveCurrentActorName(User),
                    "user.role.updated",
                    $"user:{user.Id} {previousRole}->{parsedRole}"));
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (!TryParseStatus(request.Status, out var parsedStatus))
            {
                return BadRequest(new { message = "Invalid status." });
            }

            user.Status = parsedStatus;
            updatedFields.Add("status");
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            var normalizedPassword = request.Password.Trim();
            if (!PasswordPolicyValidator.IsValid(normalizedPassword))
            {
                return BadRequest(new Dictionary<string, string>
                {
                    ["password"] = PasswordPolicyValidator.ErrorMessage
                });
            }

            user.PasswordHash = PasswordHasher.HashPassword(normalizedPassword);
            updatedFields.Add("password");
        }

        if (!string.IsNullOrWhiteSpace(request.Department))
        {
            if (!TryParseDepartmentRequest(request.Department, out var departmentId) || !departmentId.HasValue)
            {
                return BadRequest(new { message = "Invalid department." });
            }

            var departmentEntry = await dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == departmentId.Value, cancellationToken);

            if (departmentEntry is null)
            {
                return BadRequest(new { message = "Department not found." });
            }

            user.DepartmentId = departmentEntry.Id;
            resolvedDepartmentName = departmentEntry.Name;
            updatedFields.Add("department");
        }

        if (user.Role == UserRole.Intern)
        {
            var profileExists = await dbContext.InternProfiles
                .AsNoTracking()
                .AnyAsync(item => item.InternId == user.Id, cancellationToken);

            if (!profileExists)
            {
                dbContext.InternProfiles.Add(new InternProfile
                {
                    Id = Guid.NewGuid(),
                    InternId = user.Id,
                    UniversityId = null,
                    Major = string.Empty,
                    CurrentYearOfStudy = string.Empty,
                    ExpectedGraduationDate = null,
                    WorkPreference = null,
                    CvFileUrl = null,
                    StartDate = null,
                    EndDate = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });

                updatedFields.Add("internProfile");
            }
        }

        if (updatedFields.Count > 0)
        {
            var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
            var actorName = UserContextHelper.ResolveCurrentActorName(User);
            var changes = string.Join(',', updatedFields);

            dbContext.AuditLogs.Add(CreateAuditLog(actorUserId, actorName, "user.update", $"user:{user.Id} fields:{changes}"));
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDashboardUser(user, resolvedDepartmentName));
    }

    /// <summary>
    /// Archive un compte utilisateur.
    /// </summary>
    /// <remarks>
    /// Cette route place un compte en statut \"archivé\". Le compte ne peut plus se connecter
    /// mais ses données sont conservées. Les administrateurs ne peuvent pas archiver
    /// les comptes SuperAdmin. L archivage est une étape obligatoire avant la suppression.
    /// </remarks>
    /// <param name="id">Identifiant unique de l utilisateur à archiver.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations de l utilisateur archivé.</returns>
    /// <response code="200">Utilisateur archivé avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Utilisateur non trouvé.</response>
    [HttpPatch("{id:guid}/archive", Name = "ArchiveUser")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [EnableRateLimiting("write-operations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ArchiveUser(Guid id, CancellationToken cancellationToken)
    {
        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!actorUserId.HasValue)
        {
            return Unauthorized(new { message = "Unable to resolve authenticated actor user id." });
        }

        var actorUser = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(current => current.Id == actorUserId.Value, cancellationToken);

        if (actorUser is null)
        {
            return BadRequest(new { message = "Authenticated actor user does not exist." });
        }

        if (actorUser.Status != UserStatus.Active)
        {
            return BadRequest(new { message = "Authenticated actor user must be active to archive users." });
        }

        var actorName = UserContextHelper.ResolveCurrentActorName(User);

        var user = await dbContext.Users
            .Include(current => current.Department)
            .FirstOrDefaultAsync(current => current.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        var actorRole = UserContextHelper.ResolveCurrentUserRole(User);
        if (actorRole == UserRole.Admin && user.Role == UserRole.SuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Admins cannot archive SuperAdmin users." });
        }

        if (user.Role == UserRole.Intern)
        {
            var profile = await dbContext.InternProfiles
                .FirstOrDefaultAsync(item => item.InternId == user.Id, cancellationToken);

            if (profile is null)
            {
                profile = new InternProfile
                {
                    Id = Guid.NewGuid(),
                    InternId = user.Id,
                    UniversityId = null,
                    Major = string.Empty,
                    CurrentYearOfStudy = string.Empty,
                    ExpectedGraduationDate = null,
                    WorkPreference = null,
                    CvFileUrl = null,
                    StartDate = null,
                    EndDate = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                dbContext.InternProfiles.Add(profile);
            }

            var hasActiveMission = await dbContext.Missions
                .AsNoTracking()
                .AnyAsync(item => item.InternId == user.Id && item.Status == "active", cancellationToken);

            if (hasActiveMission)
            {
                return StatusCode(StatusCodes.Status409Conflict, new
                {
                    message = "Intern can be archived only when no active stage assignment exists."
                });
            }
        }

        if (user.Status == UserStatus.Archived)
        {
            return Ok(ToDashboardUser(user, user.Department?.Name));
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            dbContext.AuditLogs.Add(CreateAuditLog(actorUserId, actorName, "user.archive", $"user:{user.Id}"));
            await dbContext.SaveChangesAsync(cancellationToken);

            // Explicit self-archive handling: status update always occurs after audit insert.
            user.Status = UserStatus.Archived;

            await dbContext.SaveChangesAsync(cancellationToken);

            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }

        return Ok(ToDashboardUser(user, user.Department?.Name));
    }

    /// <summary>
    /// Supprime définitivement un utilisateur.
    /// </summary>
    /// <remarks>
    /// Cette route supprime un compte de la base de données. Pour pouvoir supprimer un utilisateur,
    /// il doit d abord être archivé et ne doit plus avoir de données liées (missions, évaluations, etc.).
    /// Cette action est irréversible. Les administrateurs ne peuvent pas supprimer les comptes SuperAdmin.
    /// </remarks>
    /// <param name="id">Identifiant unique de l utilisateur à supprimer.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Utilisateur supprimé avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Utilisateur non trouvé.</response>
    /// <response code="409">Utilisateur non archivé ou données liées présentes.</response>
    [HttpDelete("{id:guid}", Name = "DeleteUser")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [EnableRateLimiting("delete-operations")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(UserDeletionErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(UserDeletionErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(UserDeletionErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await deletionService.DeleteUserAsync(id, User, cancellationToken);
        if (result.Success)
        {
            return NoContent();
        }

        var response = new UserDeletionErrorResponse
        {
            Code = result.Code ?? UserDeletionService.ErrorUserDeleteBlocked,
            Message = result.Message ?? "User deletion failed.",
            Blockers = result.Blockers
        };

        return StatusCode(result.StatusCode, response);
    }

    /// <summary>
    /// Récupère les informations d un utilisateur spécifique.
    /// </summary>
    /// <remarks>
    /// Cette route retourne toutes les informations d un compte utilisateur
    /// (nom, email, rôle, statut, département, dernière connexion).
    /// Seuls les administrateurs peuvent accéder à cette route.
    /// </remarks>
    /// <param name="id">Identifiant unique de l utilisateur à récupérer.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations complètes de l utilisateur.</returns>
    /// <response code="200">Utilisateur récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    /// <response code="404">Utilisateur non trouvé.</response>
    [HttpGet("{id:guid}", Name = "GetUserById")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUserById(Guid id, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .Include(current => current.Department)
            .FirstOrDefaultAsync(current => current.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        return Ok(ToDashboardUser(user, user.Department?.Name));
    }

    /// <summary>
    /// Récupère un résumé du profil de l utilisateur connecté.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les informations de base de l utilisateur actuellement connecté
    /// (identifiant, nom, email, rôle, statut). Elle est accessible à tous les utilisateurs connectés.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Un résumé du profil de l utilisateur connecté.</returns>
    /// <response code="200">Résumé récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Utilisateur non trouvé.</response>
    [HttpGet("me/summary", Name = "GetUserSummary")]
    [Authorize]
    [EnableRateLimiting("read-frequent")]
    [ProducesResponseType(typeof(UserSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var userId = UserContextHelper.ResolveCurrentUserId(User);
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => new UserSummary
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                Role = u.Role.ToString(),
                Status = u.Status.ToString(),
                FullName = $"{u.FirstName} {u.LastName}"
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        return Ok(user);
    }

    private static object ToDashboardUser(User user, string? departmentName = null)
    {
        return new
        {
            id = user.Id,
            firstName = user.FirstName,
            lastName = user.LastName,
            fullName = $"{user.FirstName} {user.LastName}".Trim(),
            name = $"{user.FirstName} {user.LastName}".Trim(),
            email = user.Email,
            status = user.Status.ToString().ToLowerInvariant(),
            verificationStatus = user.VerificationStatus.ToString(),
            role = user.Role.ToString().ToLowerInvariant(),
            department = departmentName ?? user.Department?.Name,
            lastLogin = user.LastLoginAt
        };
    }

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private static bool TryResolveCreateNameParts(UpsertUserRequest request, out string firstName, out string lastName)
    {
        firstName = request.FirstName?.Trim() ?? string.Empty;
        lastName = request.LastName?.Trim() ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(lastName))
        {
            return true;
        }

        return TrySplitName(request.Name, out firstName, out lastName);
    }

    private static bool TryResolveUpdateNameParts(UpsertUserRequest request, User currentUser, out string firstName, out string lastName)
    {
        firstName = currentUser.FirstName;
        lastName = currentUser.LastName;

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            return TrySplitName(request.Name, out firstName, out lastName);
        }

        if (!string.IsNullOrWhiteSpace(request.FirstName))
        {
            firstName = request.FirstName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.LastName))
        {
            lastName = request.LastName.Trim();
        }

        return !string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(lastName);
    }

    private static bool TrySplitName(string? fullName, out string firstName, out string lastName)
    {
        firstName = string.Empty;
        lastName = string.Empty;

        if (string.IsNullOrWhiteSpace(fullName))
        {
            return false;
        }

        var parts = fullName
            .Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 0)
        {
            return false;
        }

        if (parts.Length == 1)
        {
            firstName = parts[0];
            lastName = parts[0];
            return true;
        }

        firstName = parts[0];
        lastName = string.Join(' ', parts.Skip(1));
        return true;
    }

    private static bool TryParseRole(string? rawRole, out UserRole role)
    {
        role = default;

        if (string.IsNullOrWhiteSpace(rawRole))
        {
            return false;
        }

        var normalizedRole = rawRole
            .Trim()
            .ToLowerInvariant()
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal);

        switch (normalizedRole)
        {
            case "superadmin":
                role = UserRole.SuperAdmin;
                return true;
            case "admin":
                role = UserRole.Admin;
                return true;
            case "manager":
                role = UserRole.Manager;
                return true;
            case "supervisor":
                role = UserRole.Supervisor;
                return true;
            case "intern":
                role = UserRole.Intern;
                return true;
            default:
                return false;
        }
    }

    private static bool TryParseStatus(string? rawStatus, out UserStatus status)
    {
        status = default;

        if (string.IsNullOrWhiteSpace(rawStatus))
        {
            return false;
        }

        var normalizedStatus = rawStatus
            .Trim()
            .ToLowerInvariant()
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal);

        switch (normalizedStatus)
        {
            case "active":
                status = UserStatus.Active;
                return true;
            case "archived":
            case "inactive":
                status = UserStatus.Archived;
                return true;
            default:
                return false;
        }
    }

    private static bool TryParseDepartmentFilter(string? rawDepartment, out Guid? departmentId)
    {
        departmentId = null;

        if (string.IsNullOrWhiteSpace(rawDepartment) ||
            string.Equals(rawDepartment, "all", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (Guid.TryParse(rawDepartment, out var parsedDepartmentId))
        {
            departmentId = parsedDepartmentId;
            return true;
        }

        return false;
    }

    private static bool TryParseDepartmentRequest(string? rawDepartment, out Guid? departmentId)
    {
        departmentId = null;

        if (string.IsNullOrWhiteSpace(rawDepartment))
        {
            return true;
        }

        if (Guid.TryParse(rawDepartment.Trim(), out var parsedDepartmentId))
        {
            departmentId = parsedDepartmentId;
            return true;
        }

        return false;
    }

    private static AuditLog CreateAuditLog(Guid? actorUserId, string actorName, string action, string? entity)
    {
        return new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorName,
            Action = action,
            Entity = entity,
            Timestamp = DateTime.UtcNow
        };
    }
}

/// <summary>
/// Représente le payload d entrée utilisé pour créer ou mettre à jour un utilisateur.
/// </summary>
public sealed class UpsertUserRequest
{
    public string Name { get; init; } = string.Empty;

    public string FirstName { get; init; } = string.Empty;

    public string LastName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public string Department { get; init; } = string.Empty;
}
