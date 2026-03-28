using System.Security.Claims;
using InternManager.Api.Models.DTOs.Auth;
using InternManager.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var session = await authService.LoginAsync(request.Email, request.Password, cancellationToken);
        if (session is null)
        {
            ClearAuthCookies(Response);
            return Unauthorized();
        }

        AppendAuthCookies(Response, session);
        return Ok();
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
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

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies["refresh_token"];
        var userId = ResolveCurrentUserId(User);

        await authService.LogoutAsync(userId, refreshToken, cancellationToken);

        ClearAuthCookies(Response);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        var claims = User.Claims
            .Select(claim => new
            {
                claim.Type,
                claim.Value
            });

        return Ok(claims);
    }

    private static Guid? ResolveCurrentUserId(ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirstValue("userId") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(userIdClaim, out var userId)
            ? userId
            : null;
    }

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
            Expires = session.AccessTokenExpiresAtUtc
        });
    }

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
