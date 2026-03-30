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
[ApiController]
[Route("auth")]
public sealed class AuthController(IAuthService authService, AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Authentifie un utilisateur avec son email et son mot de passe.
    /// </summary>
    /// <param name="request">Données de connexion reçues dans le corps de requête.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Une réponse `200 OK` si la session est créée, sinon `401 Unauthorized`.
    /// </returns>
    /// <remarks>
    /// Appel : POST /auth/login
    /// </remarks>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
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
    /// Crée un nouveau compte utilisateur puis ouvre une session authentifiée.
    /// </summary>
    /// <param name="request">Données d inscription reçues dans le corps de requête.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Une réponse `200 OK` si l inscription et la session réussissent,
    /// `409 Conflict` si l email existe déjà,
    /// ou `400 Bad Request` pour un rôle invalide.
    /// </returns>
    /// <remarks>
    /// Appel : POST /auth/signup
    /// </remarks>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    [AllowAnonymous]
    [HttpPost("signup")]
    [EnableRateLimiting("auth")]
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

        if (!TryResolveSignupRole(request.Role, out var requestedRole))
        {
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
            FirstName = firstName,
            LastName = lastName,
            Email = normalizedEmail,
            PasswordHash = PasswordHasher.HashPassword(password),
            Role = requestedRole,
            Status = UserStatus.Active
        };

        dbContext.Users.Add(user);

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
        return Ok();
    }

    /// <summary>
    /// Renouvelle la session à partir du cookie `refresh_token` et remet des cookies à jour.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Une réponse `200 OK` si le renouvellement réussit, sinon `401 Unauthorized`.
    /// </returns>
    /// <remarks>
    /// Appel : POST /auth/refresh
    /// </remarks>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    [AllowAnonymous]
    [HttpPost("refresh")]
    [EnableRateLimiting("auth")]
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
    /// Déconnecte l utilisateur courant et supprime les cookies d authentification.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>Une réponse `204 No Content` quand la déconnexion est terminée.</returns>
    /// <remarks>
    /// Appel : POST /auth/logout
    /// </remarks>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies["refresh_token"];
        var userId = UserContextHelper.ResolveCurrentUserId(User);

        await authService.LogoutAsync(userId, refreshToken, cancellationToken);

        ClearAuthCookies(Response);
        return NoContent();
    }

    /// <summary>
    /// Retourne les claims de l utilisateur authentifié pour diagnostic côté client.
    /// </summary>
    /// <returns>Une réponse `200 OK` contenant la liste des claims présents dans le jeton.</returns>
    /// <remarks>
    /// Appel : GET /auth/me
    /// </remarks>
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        var profile = new
        {
            userId = User.FindFirstValue("userId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier),
            email = User.FindFirstValue("email") ?? User.FindFirstValue(ClaimTypes.Email),
            role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role),
            username = User.FindFirstValue("username") ?? User.Identity?.Name
        };

        return Ok(profile);
    }

    /// <summary>
    /// Valide et convertit le rôle demandé depuis le payload d inscription.
    /// </summary>
    /// <param name="rawRole">Valeur brute reçue du client.</param>
    /// <param name="role">Rôle converti si valide.</param>
    /// <returns><see langword="true"/> si le rôle est autorisé pour auto-inscription, sinon <see langword="false"/>.</returns>
    private static bool TryResolveSignupRole(string rawRole, out UserRole role)
    {
        role = default;

        if (string.IsNullOrWhiteSpace(rawRole))
        {
            return false;
        }

        if (!Enum.TryParse<UserRole>(rawRole.Trim(), true, out var parsedRole))
        {
            return false;
        }

        if (parsedRole is UserRole.Admin or UserRole.SuperAdmin)
        {
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
