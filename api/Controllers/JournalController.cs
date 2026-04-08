using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion du journal de bord du stagiaire.
/// </summary>
/// <param name="dbContext">Contexte EF Core pour accéder aux données.</param>
[ApiController]
[Route("api/intern/me/journal")]
[Authorize(Roles = "Intern")]
public sealed class JournalController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Récupère les entrées du journal de bord du stagiaire.
    /// </summary>
    /// <remarks>
    /// Cette route retourne les entrées du journal personnel du stagiaire connecté.
    /// Les entrées sont triées par date de création, de la plus récente à la plus ancienne.
    /// Vous pouvez limiter le nombre de résultats.
    /// </remarks>
    /// <param name="limit">Nombre maximum d entrées à retourner (entre 1 et 100).</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Une liste d entrées de journal.</returns>
    /// <response code="200">Entrées récupérées avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpGet(Name = "ListJournalEntries")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMyJournalEntries([FromQuery] int limit = 10, CancellationToken cancellationToken = default)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var safeLimit = Math.Clamp(limit, 1, 100);

        var data = await dbContext.JournalEntries
            .AsNoTracking()
            .Where(entry => entry.InternId == internId.Value)
            .OrderByDescending(entry => entry.CreatedAt)
            .Take(safeLimit)
            .Select(entry => new
            {
                id = entry.Id,
                content = entry.Content,
                createdAt = entry.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data });
    }

    /// <summary>
    /// Crée une nouvelle entrée dans le journal de bord.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire d ajouter une entrée à son journal.
    /// Le contenu textuel est obligatoire. L entrée est automatiquement datée
    /// et associée au stagiaire connecté.
    /// </remarks>
    /// <param name="request">Objet contenant le contenu de l entrée.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>L entrée créée.</returns>
    /// <response code="201">Entrée créée avec succès.</response>
    /// <response code="400">Contenu manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="403">Accès refusé.</response>
    [HttpPost(Name = "CreateJournalEntry")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AddJournalEntry([FromBody] JournalEntryRequest request, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var normalizedContent = request.Content?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedContent))
        {
            return BadRequest(new { message = "Content is required." });
        }

        if (normalizedContent.Length > 4000)
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["content"] = "Journal entry cannot exceed 4000 characters."
            });
        }

        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            InternId = internId.Value,
            Content = normalizedContent,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.JournalEntries.Add(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "journal.create",
            Entity = $"journal:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var result = new
        {
            id = entry.Id,
            content = entry.Content,
            createdAt = entry.CreatedAt
        };

        return CreatedAtAction(nameof(GetJournalEntryById), new { id = entry.Id }, result);
    }

    /// <summary>
    /// Récupère une entrée spécifique du journal.
    /// </summary>
    /// <remarks>
    /// Cette route retourne le détail d une entrée de journal par son identifiant.
    /// Seul le propriétaire du journal peut accéder à ses entrées.
    /// </remarks>
    /// <param name="id">Identifiant unique de l entrée.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Le contenu de l entrée.</returns>
    /// <response code="200">Entrée récupérée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Entrée non trouvée.</response>
    [HttpGet("{id:guid}", Name = "GetJournalEntryById")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJournalEntryById(Guid id, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var entry = await dbContext.JournalEntries
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (entry is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            id = entry.Id,
            content = entry.Content,
            createdAt = entry.CreatedAt
        });
    }

    /// <summary>
    /// Met à jour le contenu d une entrée du journal.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de modifier le contenu d une entrée existante.
    /// Seul le contenu peut être modifié, la date de création reste inchangée.
    /// </remarks>
    /// <param name="id">Identifiant unique de l entrée à modifier.</param>
    /// <param name="request">Objet contenant le nouveau contenu.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>L entrée mise à jour.</returns>
    /// <response code="200">Entrée mise à jour avec succès.</response>
    /// <response code="400">Contenu manquant.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Entrée non trouvée.</response>
    [HttpPatch("{id:guid}", Name = "UpdateJournalEntry")]
    [EnableRateLimiting("write-heavy")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateJournalEntry(Guid id, [FromBody] JournalEntryRequest request, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var normalizedContent = request.Content?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedContent))
        {
            return BadRequest(new { message = "Content is required." });
        }

        if (normalizedContent.Length > 4000)
        {
            return BadRequest(new Dictionary<string, string>
            {
                ["content"] = "Journal entry cannot exceed 4000 characters."
            });
        }

        var entry = await dbContext.JournalEntries
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (entry is null)
        {
            return NotFound(new { message = "Journal entry not found." });
        }

        entry.Content = normalizedContent;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "journal.update",
            Entity = $"journal:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = entry.Id,
            content = entry.Content,
            createdAt = entry.CreatedAt
        });
    }

    /// <summary>
    /// Supprime une entrée du journal.
    /// </summary>
    /// <remarks>
    /// Cette route permet au stagiaire de supprimer définitivement une entrée de son journal.
    /// Cette action est irréversible.
    /// </remarks>
    /// <param name="id">Identifiant unique de l entrée à supprimer.</param>
    /// <param name="cancellationToken">Jeton pour annuler l opération si besoin.</param>
    /// <returns>Rien (contenu vide).</returns>
    /// <response code="204">Entrée supprimée avec succès.</response>
    /// <response code="401">Utilisateur non connecté.</response>
    /// <response code="404">Entrée non trouvée.</response>
    [HttpDelete("{id:guid}", Name = "DeleteJournalEntry")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteJournalEntry(Guid id, CancellationToken cancellationToken)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var entry = await dbContext.JournalEntries
            .FirstOrDefaultAsync(item => item.Id == id && item.InternId == internId.Value, cancellationToken);

        if (entry is null)
        {
            return NotFound(new { message = "Journal entry not found." });
        }

        dbContext.JournalEntries.Remove(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = internId,
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = "journal.delete",
            Entity = $"journal:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

public sealed class JournalEntryRequest
{
    public string Content { get; init; } = string.Empty;
}
