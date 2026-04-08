/// <summary>
/// 📁 Emplacement : api/Controllers/AuthController.cs
/// 🎯 Rôle       : Expose les endpoints HTTP d authentification (connexion, rafraîchissement, déconnexion, profil courant).
/// 📦 Contient   : [AuthController]
/// </summary>
using System.Security.Claims;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.DTOs.Auth;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur API qui gère le cycle de session utilisateur en s appuyant sur <see cref="IAuthService"/>.
/// </summary>
/// <param name="authService">Service métier responsable de la création et de la révocation des sessions.</param>
/// <param name="passwordResetService">Service métier responsable des jetons de réinitialisation de mot de passe.</param>
/// <param name="dbContext">Contexte EF Core utilisé pour les opérations de lecture/écriture liées à l authentification.</param>
[ApiController]
[Route("auth")]
public sealed class AuthController(
    IAuthService authService,
    IPasswordResetService passwordResetService,
    AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Connecte un utilisateur avec son email et son mot de passe.
    /// </summary>
    /// <remarks>
    /// Cette route vérifie les identifiants dans la base de données. Si tout est correct, elle crée une session
    /// et place deux jetons (access et refresh) dans des cookies sécurisés. Le code de retour est 200.
    /// </remarks>
    /// <param name="request">Objet contenant l email et le mot de passe de l utilisateur.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien en cas de succès (les cookies sont placés automatiquement).</returns>
    /// <response code="200">Connexion réussie, les cookies de session sont créés.</response>
    /// <response code="401">Email ou mot de passe incorrect.</response>
    [AllowAnonymous]
    [HttpPost("login", Name = "Login")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var session = await authService.LoginAsync(request.Email, request.Password, request.RememberMe, cancellationToken);
        if (session is null)
        {
            ClearAuthCookies(Response);
            return Unauthorized();
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users
            .FirstOrDefaultAsync(
                current => EF.Functions.Collate(current.Email, "SQL_Latin1_General_CP1_CI_AS") == normalizedEmail,
                cancellationToken);

        if (user is not null)
        {
            user.LastLoginAt = DateTime.UtcNow;

            dbContext.AuditLogs.Add(new AuditLog
            {
                ActorUserId = user.Id,
                Actor = user.Email,
                Action = "auth.login",
                Entity = $"user:{user.Id}",
                Timestamp = DateTime.UtcNow
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        AppendAuthCookies(Response, session);
        return Ok();
    }

    /// <summary>
    /// Crée un nouveau compte utilisateur et le connecte automatiquement.
    /// </summary>
    /// <remarks>
    /// Cette route crée un utilisateur dans la base avec le rôle demandé. Seuls les rôles Intern, Supervisor
    /// et Manager sont autorisés pour l auto-inscription. Ensuite, elle connecte l utilisateur
    /// et place les cookies de session.
    /// </remarks>
    /// <param name="request">Objet contenant les informations du nouveau compte (nom, email, mot de passe, rôle).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du compte créé.</returns>
    /// <response code="201">Compte créé avec succès, l utilisateur est connecté.</response>
    /// <response code="400">Données invalides ou rôle non autorisé.</response>
    /// <response code="409">Un compte existe déjà avec cet email.</response>
    [AllowAnonymous]
    [HttpPost("signup", Name = "Signup")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Signup([FromBody] SignupRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var firstName = request.FirstName.Trim();
        var lastName = request.LastName.Trim();
        var password = request.Password;

        if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
        {
            return BadRequest(new { message = "FirstName and LastName are required." });
        }

        if (!PasswordPolicyValidator.IsValid(password))
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["password"] = PasswordPolicyValidator.ErrorMessage
            });
        }

        if (!TryResolveSignupRole(request.Role, out var requestedRole, out var forbiddenRoleRequested))
        {
            if (forbiddenRoleRequested)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "Self-registration is only permitted for intern accounts."
                });
            }

            return BadRequest(new { message = "Selected role is not allowed for self-signup." });
        }

        var emailExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => EF.Functions.Collate(u.Email, "SQL_Latin1_General_CP1_CI_AS") == normalizedEmail, cancellationToken);

        if (emailExists)
        {
            return Conflict(new { message = "An account already exists with this email." });
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName,
            LastName = lastName,
            Email = normalizedEmail,
            PasswordHash = PasswordHasher.HashPassword(password),
            Role = requestedRole,
            Status = UserStatus.Active,
            VerificationStatus = requestedRole == UserRole.Intern
                ? InternVerificationStatus.INCOMPLETE
                : InternVerificationStatus.NOT_APPLICABLE
        };

        dbContext.Users.Add(user);

        if (requestedRole == UserRole.Intern)
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

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "An account already exists with this email." });
        }

        var session = await authService.LoginAsync(normalizedEmail, password, rememberMe: true, cancellationToken);
        if (session is null)
        {
            ClearAuthCookies(Response);
            return Unauthorized();
        }

        AppendAuthCookies(Response, session);

        var result = ToAuthMeResponse(user);

        return Created("/auth/me", result);
    }

    /// <summary>
    /// Alias explicite de l endpoint signup pour compatibilite avec les clients attendant /auth/register.
    /// </summary>
    /// <param name="request">Objet contenant les informations du nouveau compte.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Les informations du compte créé.</returns>
    /// <response code="201">Compte créé avec succès.</response>
    /// <response code="400">Données invalides ou rôle non autorisé.</response>
    /// <response code="409">Un compte existe déjà avec cet email.</response>
    [AllowAnonymous]
    [HttpPost("/api/auth/register")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status301MovedPermanently)]
    public IActionResult Register([FromBody] SignupRequest request, CancellationToken cancellationToken)
    {
        return RedirectPermanent("/api/auth/signup");
    }

    /// <summary>
    /// Demande un lien de réinitialisation de mot de passe.
    /// </summary>
    /// <remarks>
    /// Cette route envoie un email avec un lien de réinitialisation si le compte existe.
    /// Pour des raisons de sécurité, elle répond toujours 200 même si l email n existe pas,
    /// afin de ne pas révéler quels comptes sont enregistrés.
    /// </remarks>
    /// <param name="request">Objet contenant l email du compte à réinitialiser.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Un message confirmant que le processus est lancé.</returns>
    /// <response code="200">Message de confirmation (même si l email n existe pas).</response>
    [AllowAnonymous]
    [HttpPost("forgot-password", Name = "ForgotPassword")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return Ok(new { message = "If the account exists, a reset link has been sent." });
        }

        await passwordResetService.CreateResetTokenAsync(request.Email, cancellationToken);

        return Ok(new { message = "If the account exists, a reset link has been sent." });
    }

    /// <summary>
    /// Réinitialise le mot de passe avec un jeton reçu par email.
    /// </summary>
    /// <remarks>
    /// Cette route prend le jeton envoyé par email et un nouveau mot de passe.
    /// Le jeton ne peut être utilisé qu une seule fois et expire après un certain temps.
    /// Après réinitialisation, l utilisateur est déconnecté de toutes ses sessions.
    /// </remarks>
    /// <param name="request">Objet contenant le jeton de réinitialisation et le nouveau mot de passe.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Un message confirmant le changement de mot de passe.</returns>
    /// <response code="200">Mot de passe réinitialisé avec succès.</response>
    /// <response code="400">Jeton invalide ou expiré.</response>
    [AllowAnonymous]
    [HttpPost("reset-password", Name = "ResetPassword")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Invalid payload." });
        }

        var updatedUserId = await passwordResetService.ResetPasswordAsync(request.Token, request.NewPassword, cancellationToken);
        if (!updatedUserId.HasValue)
        {
            return BadRequest(new { message = "Invalid or expired reset token." });
        }

        await authService.LogoutAsync(updatedUserId, refreshToken: null, cancellationToken);
        ClearAuthCookies(Response);

        return Ok(new { message = "Password has been reset successfully." });
    }

    /// <summary>
    /// Renouvelle la session de l utilisateur.
    /// </summary>
    /// <remarks>
    /// Cette route utilise le jeton de rafraîchissement stocké dans un cookie pour générer
    /// un nouveau jeton d accès. Les cookies sont automatiquement mis à jour.
    /// Cela permet de rester connecté sans avoir à se reconnecter.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (les cookies de session sont mis à jour).</returns>
    /// <response code="200">Session renouvelée avec succès.</response>
    /// <response code="401">Jeton de rafraîchissement invalide ou expiré.</response>
    [AllowAnonymous]
    [HttpPost("refresh", Name = "RefreshToken")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies["refresh_token"];
        var session = await authService.RefreshAsync(refreshToken ?? string.Empty, cancellationToken);

        if (session is null)
        {
            ClearAuthCookies(Response);
            return Unauthorized();
        }

        AppendAuthCookies(Response, session);
        return Ok();
    }

    /// <summary>
    /// Déconnecte l utilisateur actuel.
    /// </summary>
    /// <remarks>
    /// Cette route invalide le jeton de rafraîchissement dans la base de données
    /// et supprime les cookies de session. L utilisateur doit se reconnecter
    /// pour accéder aux routes protégées.
    /// </remarks>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="200">Déconnexion traitée (idempotent).</response>
    [AllowAnonymous]
    [HttpPost("logout", Name = "Logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies["refresh_token"];
        var userId = UserContextHelper.ResolveCurrentUserId(User);

        await authService.LogoutAsync(userId, refreshToken, cancellationToken);

        ClearAuthCookies(Response);
        return Ok();
    }

    /// <summary>
    /// Récupère les informations de l utilisateur connecté.
    /// </summary>
    /// <remarks>
    /// Cette route lit le jeton d accès pour identifier l utilisateur et retourne
    /// ses informations de profil (identifiant, nom, email, rôle, statut).
    /// Utile pour vérifier que la connexion fonctionne correctement.
    /// </remarks>
    /// <returns>Les informations du profil de l utilisateur connecté.</returns>
    /// <response code="200">Profil récupéré avec succès.</response>
    /// <response code="401">Utilisateur non connecté ou jeton invalide.</response>
    [Authorize]
    [HttpGet("me", Name = "GetCurrentUser")]
    [ProducesResponseType(typeof(AuthMeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Me()
    {
        var userIdClaim = User.FindFirstValue("userId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var user = dbContext.Users
            .AsNoTracking()
            .FirstOrDefault(current => current.Id == userId);

        if (user is null)
        {
            return Unauthorized();
        }

        var profile = ToAuthMeResponse(user);

        return Ok(profile);
    }

    private static AuthMeResponse ToAuthMeResponse(User user)
    {
        return new AuthMeResponse
        {
            Id = user.Id,
            FirstName = user.FirstName,
            LastName = user.LastName,
            FullName = $"{user.FirstName} {user.LastName}".Trim(),
            Email = user.Email,
            Role = user.Role.ToString(),
            Status = user.Status.ToString().ToLowerInvariant()
        };
    }

    /// <summary>
    /// Valide et convertit le rôle demandé depuis le payload d inscription.
    /// </summary>
    /// <param name="rawRole">Valeur brute reçue du client.</param>
    /// <param name="role">Rôle converti si valide.</param>
    /// <returns><see langword="true"/> si le rôle est autorisé pour auto-inscription, sinon <see langword="false"/>.</returns>
    private static bool TryResolveSignupRole(string rawRole, out UserRole role, out bool forbiddenRoleRequested)
    {
        role = default;
        forbiddenRoleRequested = false;

        if (string.IsNullOrWhiteSpace(rawRole))
        {
            return false;
        }

        if (!Enum.TryParse<UserRole>(rawRole.Trim(), true, out var parsedRole))
        {
            return false;
        }

        if (parsedRole != UserRole.Intern)
        {
            forbiddenRoleRequested = true;
            return false;
        }

        role = parsedRole;
        return true;
    }

    /// <summary>
    /// Ajoute les cookies d authentification et le cookie CSRF dans la réponse HTTP.
    /// </summary>
    /// <param name="response">Réponse HTTP sur laquelle écrire les cookies.</param>
    /// <param name="session">Session contenant les jetons et les dates d expiration.</param>
    private static void AppendAuthCookies(HttpResponse response, AuthSessionTokens session)
    {
        response.Cookies.Append("access_token", session.AccessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = session.AccessTokenExpiresAtUtc
        });

        response.Cookies.Append("refresh_token", session.RefreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = session.RefreshTokenExpiresAtUtc
        });

        response.Cookies.Append("csrf_token", session.CsrfToken, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = session.RefreshTokenExpiresAtUtc
        });
    }

    /// <summary>
    /// Écrase les cookies d authentification avec une date expirée pour forcer leur suppression côté client.
    /// </summary>
    /// <param name="response">Réponse HTTP sur laquelle écrire les cookies expirés.</param>
    private static void ClearAuthCookies(HttpResponse response)
    {
        var expiredAt = DateTimeOffset.UtcNow.AddDays(-1);

        response.Cookies.Append("access_token", string.Empty, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = expiredAt
        });

        response.Cookies.Append("refresh_token", string.Empty, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = expiredAt
        });

        response.Cookies.Append("csrf_token", string.Empty, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = expiredAt
        });
    }
}
