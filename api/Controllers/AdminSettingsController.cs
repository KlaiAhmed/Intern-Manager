/// <summary>
/// Expose les endpoints admin de parametrage et de gestion des referentiels.
/// </summary>
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/admin/settings")]
[Authorize]
public sealed class AdminSettingsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("departments", Name = "ListDepartments")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetDepartments(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Departments, cancellationToken);
    }

    [HttpGet("departments/{id:guid}", Name = "GetDepartmentById")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetDepartmentById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.Departments, id, cancellationToken);
    }

    [HttpPost("departments", Name = "CreateDepartment")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateDepartment([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Departments, request, nameof(GetDepartmentById), cancellationToken);
    }

    [HttpPatch("departments/{id:guid}", Name = "UpdateDepartment")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateDepartment(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Departments, id, request, cancellationToken);
    }

    [HttpDelete("departments/{id:guid}", Name = "DeleteDepartment")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteDepartment(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Departments, id, cancellationToken);
    }

    [HttpGet("schools", Name = "ListSchools")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetSchools(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Schools, cancellationToken);
    }

    [HttpGet("schools/{id:guid}", Name = "GetSchoolById")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetSchoolById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.Schools, id, cancellationToken);
    }

    [HttpPost("schools", Name = "CreateSchool")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateSchool([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Schools, request, nameof(GetSchoolById), cancellationToken);
    }

    [HttpPatch("schools/{id:guid}", Name = "UpdateSchool")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateSchool(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Schools, id, request, cancellationToken);
    }

    [HttpDelete("schools/{id:guid}", Name = "DeleteSchool")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteSchool(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Schools, id, cancellationToken);
    }

    [HttpGet("internship-types", Name = "ListInternshipTypes")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetInternshipTypes(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.InternshipTypes, cancellationToken);
    }

    [HttpGet("internship-types/{id:guid}", Name = "GetInternshipTypeById")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetInternshipTypeById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.InternshipTypes, id, cancellationToken);
    }

    [HttpPost("internship-types", Name = "CreateInternshipType")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateInternshipType([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.InternshipTypes, request, nameof(GetInternshipTypeById), cancellationToken);
    }

    [HttpPatch("internship-types/{id:guid}", Name = "UpdateInternshipType")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateInternshipType(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.InternshipTypes, id, request, cancellationToken);
    }

    [HttpDelete("internship-types/{id:guid}", Name = "DeleteInternshipType")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteInternshipType(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.InternshipTypes, id, cancellationToken);
    }

    [HttpGet("skills", Name = "ListSkills")]
    [Authorize(Roles = "Admin,Supervisor")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetSkills(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.Skills, cancellationToken);
    }

    [HttpGet("skills/{id:guid}", Name = "GetSkillById")]
    [Authorize(Roles = "Admin,Supervisor")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetSkillById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.Skills, id, cancellationToken);
    }

    [HttpPost("skills", Name = "CreateSkill")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateSkill([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.Skills, request, nameof(GetSkillById), cancellationToken);
    }

    [HttpPatch("skills/{id:guid}", Name = "UpdateSkill")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateSkill(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.Skills, id, request, cancellationToken);
    }

    [HttpDelete("skills/{id:guid}", Name = "DeleteSkill")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> DeleteSkill(Guid id, CancellationToken cancellationToken)
    {
        return DeleteReferentialItemAsync(dbContext.Skills, id, cancellationToken);
    }

    [HttpGet("statuses", Name = "ListStatuses")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IEnumerable<ReferentialResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> GetStatuses(CancellationToken cancellationToken)
    {
        return GetReferentialItemsAsync(dbContext.UserStatusReferences, cancellationToken);
    }

    [HttpGet("statuses/{id:guid}", Name = "GetStatusById")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReferentialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> GetStatusById(Guid id, CancellationToken cancellationToken)
    {
        return GetReferentialItemByIdAsync(dbContext.UserStatusReferences, id, cancellationToken);
    }

    [HttpPost("statuses", Name = "CreateStatus")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> CreateStatus([FromBody] UpsertReferentialRequest request, CancellationToken cancellationToken)
    {
        return CreateReferentialItemAsync(dbContext.UserStatusReferences, request, nameof(GetStatusById), cancellationToken);
    }

    [HttpPatch("statuses/{id:guid}", Name = "UpdateStatus")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateReferentialRequest request, CancellationToken cancellationToken)
    {
        return UpdateReferentialItemAsync(dbContext.UserStatusReferences, id, request, cancellationToken);
    }

    [HttpDelete("statuses/{id:guid}", Name = "DeleteStatus")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
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

    private async Task<IActionResult> GetReferentialItemByIdAsync<TEntity>(DbSet<TEntity> dbSet, Guid id, CancellationToken cancellationToken)
        where TEntity : ReferentialEntityBase
    {
        var entry = await dbSet
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        return entry is null
            ? NotFound()
            : Ok(ToResponse(entry));
    }

    private async Task<IActionResult> CreateReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, UpsertReferentialRequest request, string getByIdActionName, CancellationToken cancellationToken)
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

        var result = ToResponse(entry);
        return CreatedAtAction(getByIdActionName, new { id = entry.Id }, result);
    }

    private async Task<IActionResult> UpdateReferentialItemAsync<TEntity>(DbSet<TEntity> dbSet, Guid id, UpdateReferentialRequest request, CancellationToken cancellationToken)
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
