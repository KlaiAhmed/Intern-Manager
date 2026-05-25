using System.Security.Claims;
using InternManager.Api.Application.Users.Models;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Application.Users;

public sealed class UserDeletionService
{
    public const string ErrorUserNotFound = "USER_NOT_FOUND";
    public const string ErrorUserNotArchived = "USER_NOT_ARCHIVED";
    public const string ErrorUserDeleteForbidden = "USER_DELETE_FORBIDDEN";
    public const string ErrorUserDeleteBlocked = "USER_DELETE_BLOCKED";

    private readonly AppDbContext dbContext;
    private readonly UserDeletionPolicy policy;

    public UserDeletionService(AppDbContext dbContext, UserDeletionPolicy policy)
    {
        this.dbContext = dbContext;
        this.policy = policy;
    }

    public async Task<UserDeletionResult> DeleteUserAsync(
        Guid userId,
        ClaimsPrincipal actor,
        CancellationToken cancellationToken)
    {
        var actorRole = UserContextHelper.ResolveCurrentUserRole(actor);
        var actorUserId = UserContextHelper.ResolveCurrentUserId(actor);
        var actorName = UserContextHelper.ResolveCurrentActorName(actor);

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(current => current.Id == userId, cancellationToken);

        if (user is null)
        {
            return UserDeletionResult.NotFound();
        }

        if (actorRole == UserRole.Admin && user.Role == UserRole.SuperAdmin)
        {
            return UserDeletionResult.Forbidden();
        }

        if (user.Status != UserStatus.Archived)
        {
            return UserDeletionResult.NotArchived();
        }

        var blockers = await policy.GetBlockersAsync(dbContext, userId, cancellationToken);
        if (blockers.HasBlockers)
        {
            return UserDeletionResult.Blocked(blockers);
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var deletionTarget = await dbContext.Users
            .FirstOrDefaultAsync(current => current.Id == userId, cancellationToken);

        if (deletionTarget is null)
        {
            return UserDeletionResult.NotFound();
        }

        if (actorRole == UserRole.Admin && deletionTarget.Role == UserRole.SuperAdmin)
        {
            return UserDeletionResult.Forbidden();
        }

        if (deletionTarget.Status != UserStatus.Archived)
        {
            return UserDeletionResult.NotArchived();
        }

        dbContext.AuditLogs.Add(BuildAuditLog(actorUserId, actorName, deletionTarget));
        dbContext.Users.Remove(deletionTarget);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return UserDeletionResult.NotFound();
        }

        return UserDeletionResult.Succeeded();
    }

    private static AuditLog BuildAuditLog(Guid? actorUserId, string actorName, User user)
    {
        var targetRole = user.Role.ToString();
        var entity =
            $"targetUserId={user.Id} targetEmail={user.Email} targetRole={targetRole} " +
            $"deletedBy={actorName} deletionMode=permanent";

        return new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorName,
            Action = "user.delete",
            Entity = entity,
            Timestamp = DateTime.UtcNow
        };
    }
}

public sealed class UserDeletionResult
{
    public bool Success { get; init; }

    public int StatusCode { get; init; }

    public string? Code { get; init; }

    public string? Message { get; init; }

    public UserDeletionBlockers? Blockers { get; init; }

    public static UserDeletionResult NotFound() => new()
    {
        Success = false,
        StatusCode = StatusCodes.Status404NotFound,
        Code = UserDeletionService.ErrorUserNotFound,
        Message = "User not found."
    };

    public static UserDeletionResult NotArchived() => new()
    {
        Success = false,
        StatusCode = StatusCodes.Status409Conflict,
        Code = UserDeletionService.ErrorUserNotArchived,
        Message = "Only archived users can be deleted."
    };

    public static UserDeletionResult Forbidden() => new()
    {
        Success = false,
        StatusCode = StatusCodes.Status403Forbidden,
        Code = UserDeletionService.ErrorUserDeleteForbidden,
        Message = "You do not have permission to delete this user."
    };

    public static UserDeletionResult Blocked(UserDeletionBlockers blockers) => new()
    {
        Success = false,
        StatusCode = StatusCodes.Status409Conflict,
        Code = UserDeletionService.ErrorUserDeleteBlocked,
        Message = "User deletion is blocked by existing business data.",
        Blockers = blockers
    };

    public static UserDeletionResult Succeeded() => new()
    {
        Success = true,
        StatusCode = StatusCodes.Status204NoContent
    };
}

public sealed class UserDeletionErrorResponse
{
    public string Code { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;

    public UserDeletionBlockers? Blockers { get; init; }
}
