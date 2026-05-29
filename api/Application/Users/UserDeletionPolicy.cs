using InternManager.Api.Application.Users.Models;
using InternManager.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Application.Users;

/// <summary>
/// Central policy that documents which user relationships are allowed to be deleted
/// by EF Core (Cascade/SetNull) and which are true Restrict blockers.
/// </summary>
public sealed class UserDeletionPolicy
{
    public async Task<UserDeletionBlockers> GetBlockersAsync(
        AppDbContext dbContext,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var missionsAsSupervisor = await dbContext.Missions
            .AsNoTracking()
            .CountAsync(item => item.SupervisorId == userId, cancellationToken);

        var deliverablesAsSupervisor = await dbContext.Deliverables
            .AsNoTracking()
            .CountAsync(item => item.SupervisorId == userId, cancellationToken);

        var evaluations = await dbContext.Evaluations
            .AsNoTracking()
            .CountAsync(item => item.SupervisorId == userId || item.InternId == userId, cancellationToken);

        var meetings = await dbContext.Meetings
            .AsNoTracking()
            .CountAsync(item => item.SupervisorId == userId || item.InternId == userId, cancellationToken);

        var journalComments = await dbContext.JournalComments
            .AsNoTracking()
            .CountAsync(item => item.AuthorId == userId, cancellationToken);

        var journalEvaluationLinks = await dbContext.JournalEvaluationLinks
            .AsNoTracking()
            .CountAsync(item => item.LinkedByUserId == userId, cancellationToken);

        return new UserDeletionBlockers
        {
            MissionsAsSupervisor = missionsAsSupervisor,
            DeliverablesAsSupervisor = deliverablesAsSupervisor,
            Evaluations = evaluations,
            Meetings = meetings,
            JournalComments = journalComments,
            JournalEvaluationLinks = journalEvaluationLinks
        };
    }
}
