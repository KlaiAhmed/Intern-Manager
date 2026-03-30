/// <summary>
/// 📁 Emplacement : api/Controllers/UsersController.cs
/// 🎯 Rôle : Expose les opérations de gestion des utilisateurs pour les dashboards admin.
/// 📦 Contient : [UsersController]
/// </summary>
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

/// <summary>
/// Contrôleur de gestion des utilisateurs (liste, création, mise à jour).
/// </summary>
/// <param name="dbContext">Contexte EF Core pour manipuler les utilisateurs.</param>
[ApiController]
[Route("api/users")]
[Authorize(Roles = "SuperAdmin,Admin")]
public sealed class UsersController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Retourne la liste paginée des utilisateurs selon des filtres optionnels.
    /// </summary>
    [HttpGet]
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
    /// Crée un nouvel utilisateur.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] UpsertUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Email is required." });
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

        var (firstName, lastName) = SplitName(request.Name);
        var effectivePassword = string.IsNullOrWhiteSpace(request.Password)
            ? BuildTemporaryPassword()
            : request.Password.Trim();

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
            DepartmentId = departmentId
        };

        dbContext.Users.Add(user);

        var actorUserId = UserContextHelper.ResolveCurrentUserId(User);
        var actorName = UserContextHelper.ResolveCurrentActorName(User);
        dbContext.AuditLogs.Add(CreateAuditLog(actorUserId, actorName, "user.create", $"user:{user.Id}"));

        await dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, ToDashboardUser(user, departmentName));
    }

    /// <summary>
    /// Met à jour partiellement un utilisateur.
    /// </summary>
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpsertUserRequest request, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .Include(current => current.Department)
            .FirstOrDefaultAsync(current => current.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        var updatedFields = new List<string>();
        var resolvedDepartmentName = user.Department?.Name;

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var (firstName, lastName) = SplitName(request.Name);

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

            user.Role = parsedRole;
            updatedFields.Add("role");
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
            user.PasswordHash = PasswordHasher.HashPassword(request.Password.Trim());
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

    private static object ToDashboardUser(User user, string? departmentName = null)
    {
        return new
        {
            id = user.Id,
            name = $"{user.FirstName} {user.LastName}".Trim(),
            email = user.Email,
            status = user.Status.ToString().ToLowerInvariant(),
            role = user.Role.ToString().ToLowerInvariant(),
            department = departmentName ?? user.Department?.Name,
            lastLogin = user.LastLoginAt
        };
    }

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private static (string FirstName, string LastName) SplitName(string fullName)
    {
        var parts = fullName
            .Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 0)
        {
            return ("User", "Generated");
        }

        if (parts.Length == 1)
        {
            return (parts[0], "User");
        }

        return (parts[0], string.Join(' ', parts.Skip(1)));
    }

    private static string BuildTemporaryPassword()
    {
        return $"Tmp@{Guid.NewGuid():N}aA1";
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

    public string Email { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public string Department { get; init; } = string.Empty;
}
