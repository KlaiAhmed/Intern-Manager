/// <summary>
/// 📁 Emplacement : api/Controllers/UserController.cs
/// 🎯 Rôle : Expose les endpoints HTTP liés au profil utilisateur courant.
/// 📦 Contient : [UserController]
/// </summary>
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.DTOs.User;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur API qui gère les opérations sur le profil de l utilisateur authentifié.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données utilisateur.</param>
[ApiController]
[Route("me")]
[Authorize]
public sealed class UserController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Retourne un résumé du profil de l utilisateur actuellement authentifié.
    /// </summary>
    /// <param name="cancellationToken">Jeton pour annuler l opération asynchrone.</param>
    /// <returns>
    /// Une réponse `200 OK` avec le résumé du profil, ou `404 Not Found` si l utilisateur n existe plus.
    /// </returns>
    /// <remarks>
    /// Appel : GET /me/summary
    /// </remarks>
    /// <exception cref="OperationCanceledException">Levée si l opération est annulée via <paramref name="cancellationToken"/>.</exception>
    [HttpGet("summary")]
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
}
