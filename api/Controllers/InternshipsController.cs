using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/internships")]
[Authorize]
public sealed class InternshipsController(IInternshipsService service, AppDbContext dbContext) : ControllerBase
{
    private readonly IInternshipsService _service = service;
    private readonly AppDbContext _dbContext = dbContext;

    [HttpGet(Name = "ListInternships")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
    [ProducesResponseType(typeof(PagedResponse<InternshipResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? department,
        [FromQuery] string? supervisorId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        if (User.IsInRole("Supervisor"))
        {
            var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
            if (!currentSupervisorId.HasValue)
            {
                return Unauthorized();
            }

            if (!UserContextHelper.IsCurrentSupervisorScope(supervisorId, currentSupervisorId.Value))
            {
                return Forbid();
            }

            supervisorId = currentSupervisorId.Value.ToString();
        }

        try
        {
            var result = await _service.GetAllAsync(status, department, supervisorId, page, limit, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("{id:guid}", Name = "GetInternshipById")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor,Intern")]
    [ProducesResponseType(typeof(InternshipResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInternshipById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _service.GetByIdAsync(id, cancellationToken);
        if (result is null)
        {
            return NotFound(new { message = "Internship not found." });
        }

        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var isAdmin = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var isManager = User.IsInRole("Manager");
        var isSupervisorScope = User.IsInRole("Supervisor") && result.SupervisorId == currentUserId.Value;
        var isInternScope = User.IsInRole("Intern") && result.InternId == currentUserId.Value;

        if (!isAdmin && !isManager && !isSupervisorScope && !isInternScope)
        {
            return Forbid();
        }

        return Ok(result);
    }

    [HttpPost(Name = "CreateInternship")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(typeof(InternshipResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateInternshipRequest request, CancellationToken cancellationToken)
    {
        if (User.IsInRole("Supervisor"))
        {
            var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
            if (!currentSupervisorId.HasValue)
            {
                return Unauthorized();
            }

            if (!string.IsNullOrWhiteSpace(request.SupervisorId) &&
                (!Guid.TryParse(request.SupervisorId.Trim(), out var requestedSupervisorId) ||
                 requestedSupervisorId != currentSupervisorId.Value))
            {
                return Forbid();
            }

            request.SupervisorId = currentSupervisorId.Value.ToString();
        }

        try
        {
            var result = await _service.CreateAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetInternshipById), new { id = result.Id }, result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = exception.Message });
        }
    }

    [HttpPatch("{id:guid}", Name = "UpdateInternship")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(typeof(InternshipResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateInternshipRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await _service.GetByIdAsync(id, cancellationToken);
        if (existing is null)
        {
            return NotFound(new { message = "Internship not found." });
        }

        if (User.IsInRole("Supervisor"))
        {
            var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
            if (!currentSupervisorId.HasValue)
            {
                return Unauthorized();
            }

            if (existing.SupervisorId != currentSupervisorId.Value)
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(request.SupervisorId) &&
                (!Guid.TryParse(request.SupervisorId.Trim(), out var requestedSupervisorId) ||
                 requestedSupervisorId != currentSupervisorId.Value))
            {
                return Forbid();
            }
        }

        try
        {
            var result = await _service.UpdateAsync(id, request, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = exception.Message });
        }
    }

    [HttpDelete("{id:guid}", Name = "DeleteInternship")]
    [Authorize(Roles = "SuperAdmin,Admin,Supervisor")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (User.IsInRole("Supervisor"))
        {
            var currentSupervisorId = UserContextHelper.ResolveCurrentUserId(User);
            if (!currentSupervisorId.HasValue)
            {
                return Unauthorized();
            }

            var existing = await _service.GetByIdAsync(id, cancellationToken);
            if (existing is null)
            {
                return NotFound(new { message = "Internship not found." });
            }

            if (existing.SupervisorId != currentSupervisorId.Value)
            {
                return Forbid();
            }
        }

        try
        {
            await _service.DeleteAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Internship not found." });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = exception.Message });
        }
    }

    [HttpGet("{id:guid}/history", Name = "GetInternshipHistory")]
    [Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor,Intern")]
    [ProducesResponseType(typeof(PagedResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistory(Guid id, [FromQuery] int page = 1, [FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        var mission = await _dbContext.Missions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (mission is null)
        {
            return NotFound(new { message = "Internship not found." });
        }

        var currentUserId = UserContextHelper.ResolveCurrentUserId(User);
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var isAdmin = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        var isManager = User.IsInRole("Manager");
        var isSupervisorScope = User.IsInRole("Supervisor") && mission.SupervisorId == currentUserId.Value;
        var isInternScope = User.IsInRole("Intern") && mission.InternId == currentUserId.Value;

        if (!isAdmin && !isManager && !isSupervisorScope && !isInternScope)
        {
            return Forbid();
        }

        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = _dbContext.MissionHistoryEntries
            .AsNoTracking()
            .Where(item => item.MissionId == id);

        var total = await query.CountAsync(cancellationToken);

        var data = await query
            .OrderByDescending(item => item.ChangedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .Select(item => new
            {
                id = item.Id,
                field = item.Field,
                oldValue = item.OldValue,
                newValue = item.NewValue,
                changedBy = item.ChangedBy,
                changedAt = item.ChangedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new { data, total, page = safePage, limit = safeLimit });
    }
}
