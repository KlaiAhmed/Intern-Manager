/// <summary>
/// Expose les endpoints admin de parametrage et de gestion des referentiels.
/// </summary>
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public sealed class AdminSettingsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("departments")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> GetDepartments(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Departments, cancellationToken);
    }

    [HttpPost("departments")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> CreateDepartment([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Departments, request, cancellationToken);
    }

    [HttpPatch("departments/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> UpdateDepartment(Guid id, [FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Departments, id, request, cancellationToken);
    }

    [HttpDelete("departments/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteDepartment(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Departments, id, cancellationToken);
    }

    [HttpGet("schools")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> GetSchools(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Schools, cancellationToken);
    }

    [HttpPost("schools")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> CreateSchool([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Schools, request, cancellationToken);
    }

    [HttpPatch("schools/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> UpdateSchool(Guid id, [FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Schools, id, request, cancellationToken);
    }

    [HttpDelete("schools/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteSchool(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Schools, id, cancellationToken);
    }

    [HttpGet("internship-types")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> GetInternshipTypes(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.InternshipTypes, cancellationToken);
    }

    [HttpPost("internship-types")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> CreateInternshipType([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.InternshipTypes, request, cancellationToken);
    }

    [HttpPatch("internship-types/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> UpdateInternshipType(Guid id, [FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.InternshipTypes, id, request, cancellationToken);
    }

    [HttpDelete("internship-types/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteInternshipType(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.InternshipTypes, id, cancellationToken);
    }

    [HttpGet("skills")]
    [Authorize(Roles = "Admin,Supervisor")]
    public Task<IActionResult> GetSkills(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Skills, cancellationToken);
    }

    [HttpPost("skills")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> CreateSkill([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Skills, request, cancellationToken);
    }

    [HttpPatch("skills/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> UpdateSkill(Guid id, [FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Skills, id, request, cancellationToken);
    }

    [HttpDelete("skills/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteSkill(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Skills, id, cancellationToken);
    }

    [HttpGet("statuses")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> GetStatuses(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.UserStatusReferences, cancellationToken);
    }

    [HttpPost("statuses")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> CreateStatus([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.UserStatusReferences, request, cancellationToken);
    }

    [HttpPatch("statuses/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.UserStatusReferences, id, request, cancellationToken);
    }

    [HttpDelete("statuses/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteStatus(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.UserStatusReferences, id, cancellationToken);
    }

    private static string? NormalizeName(string? rawName)
    {
        if (string.IsNullOrWhiteSpace(rawName))
        {
            return null;
        }

        var tokens = rawName
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (tokens.Length == 0)
        {
            return null;
        }

        return string.Join(' ', tokens);
    }

    private static string BuildDuplicateMessage(string name)
    {
        return $"An entry with name '{name}' already exists.";
    }

    private static string BuildNotFoundMessage(Guid id)
    {
        return $"Entry '{id}' was not found.";
    }

    private static object ToResponse(ReferentialEntityBase item)
    {
        return new
        {
            id = item.Id,
            name = item.Name
        };
    }

    private static async Task<bool> ExistsByNameAsync<TEntity>(DbSet<TEntity> dbSet, string normalizedName, Guid? excludedId, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        return await dbSet
            .AsNoTracking()
            .AnyAsync(item =>
                (excludedId == null || item.Id != excludedId.Value) &&
                EF.Functions.Collate(item.Name, "SQL_Latin1_General_CP1_CI_AS") == normalizedName,
                cancellationToken);
    }

    private async Task<IActionResult> GetReferentialItemsAsync<TEntity>(DbSet<TEntity> dbSet, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var data = await dbSet
            .AsNoTracking()
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);

        return Ok(new { data = data.Select(ToResponse) });
    }

    private async Task<IActionResult> CreateReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, UpsertReferentialRequest request, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase, new()
    {
        var normalizedName = NormalizeName(request.Name);
        if (normalizedName is null)
        {
            return BadRequest(new { message = "Name is required." });
        }

        if (await ExistsByNameAsync(dbSet, normalizedName, null, cancellationToken))
        {
            return Conflict(new { message = BuildDuplicateMessage(normalizedName) });
        }

        var entry = new TEntity
        {
            Name = normalizedName
        };

        dbSet.Add(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = UserContextHelper.ResolveCurrentUserId(User),
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = $"settings.{typeof(TEntity).Name.ToLowerInvariant()}.create",
            Entity = $"{typeof(TEntity).Name.ToLowerInvariant()}:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, ToResponse(entry));
    }

    private async Task<IActionResult> UpdateReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, Guid id, UpsertReferentialRequest request, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var normalizedName = NormalizeName(request.Name);
        if (normalizedName is null)
        {
            return BadRequest(new { message = "Name is required." });
        }

        var entry = await dbSet.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entry is null)
        {
            return NotFound(new { message = BuildNotFoundMessage(id) });
        }

        if (await ExistsByNameAsync(dbSet, normalizedName, id, cancellationToken))
        {
            return Conflict(new { message = BuildDuplicateMessage(normalizedName) });
        }

        entry.Name = normalizedName;

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = UserContextHelper.ResolveCurrentUserId(User),
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = $"settings.{typeof(TEntity).Name.ToLowerInvariant()}.update",
            Entity = $"{typeof(TEntity).Name.ToLowerInvariant()}:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(entry));
    }

    private async Task<IActionResult> DeleteReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, Guid id, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var entry = await dbSet.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entry is null)
        {
            return NotFound(new { message = BuildNotFoundMessage(id) });
        }

        if (typeof(TEntity) == typeof(Department))
        {
            var usageCount = await dbContext.Users
                .AsNoTracking()
                .CountAsync(user => user.DepartmentId == id, cancellationToken);

            if (usageCount > 0)
            {
                return StatusCode(StatusCodes.Status409Conflict, new
                {
                    message = $"Cannot delete entry '{id}' because it is still used by {usageCount} user(s)."
                });
            }
        }

        dbSet.Remove(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = UserContextHelper.ResolveCurrentUserId(User),
            Actor = UserContextHelper.ResolveCurrentActorName(User),
            Action = $"settings.{typeof(TEntity).Name.ToLowerInvariant()}.delete",
            Entity = $"{typeof(TEntity).Name.ToLowerInvariant()}:{entry.Id}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }
}

public sealed class UpsertReferentialRequest
{
    public string Name { get; init; } = string.Empty;
}
