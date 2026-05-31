using System.Collections.Concurrent;
using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class MissionStateService : IMissionStateService
{
    private const string InMemoryProviderName = "Microsoft.EntityFrameworkCore.InMemory";
    private static readonly ConcurrentDictionary<Guid, byte> InMemoryCompletionClaims = new();

    private readonly INotificationService notificationService;

    public MissionStateService(INotificationService notificationService)
    {
        this.notificationService = notificationService;
    }

    public async Task CheckCompletionAsync(Guid missionId, AppDbContext db)
    {
        var deliverableStatuses = await db.Deliverables
            .AsNoTracking()
            .Where(deliverable =>
                deliverable.MissionId == missionId &&
                deliverable.Status != DomainStatuses.Deliverable.Cancelled)
            .Select(deliverable => deliverable.Status)
            .ToListAsync();

        if (deliverableStatuses.Count == 0 ||
            deliverableStatuses.Any(status => !IsApprovedStatus(status)))
        {
            return;
        }

        var updatedRows = await MarkMissionCompletedAsync(missionId, db);
        if (updatedRows == 0)
        {
            return;
        }

        AddHistory(db, "Mission", missionId, "mission.completed", null, null, DateTime.UtcNow);

        var mission = await db.Missions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == missionId, cancellationToken: default);

        if (mission is null)
        {
            return;
        }

        var recipientIds = new HashSet<Guid>();

        if (mission.InternId.HasValue)
        {
            recipientIds.Add(mission.InternId.Value);
        }

        recipientIds.Add(mission.SupervisorId);

        if (mission.CoSupervisorId.HasValue)
        {
            recipientIds.Add(mission.CoSupervisorId.Value);
        }

        var assignedInternIds = await db.MissionInternAssignments
            .AsNoTracking()
            .Where(item => item.MissionId == missionId)
            .Select(item => item.InternId)
            .Distinct()
            .ToListAsync();

        foreach (var assignedInternId in assignedInternIds)
        {
            recipientIds.Add(assignedInternId);
        }

        if (assignedInternIds.Count == 0 && mission.InternId.HasValue)
        {
            assignedInternIds.Add(mission.InternId.Value);
            recipientIds.Add(mission.InternId.Value);
        }

        var managerIds = await db.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Manager)
            .Select(user => user.Id)
            .ToListAsync();

        foreach (var managerId in managerIds)
        {
            recipientIds.Add(managerId);
        }

        foreach (var recipientId in recipientIds)
        {
            notificationService.QueueNotification(
                recipientId,
                "mission.completed",
                "Mission completed",
                "Your mission has been completed.",
                missionId.ToString());
        }
    }

    public async Task PauseAsync(Guid missionId, Guid actorId, AppDbContext db)
    {
        var mission = await LoadMissionAsync(missionId, db);

        if (!IsStatus(mission.Status, DomainStatuses.Mission.Active))
        {
            throw new InvalidOperationException("Only active missions can be paused.");
        }

        TransitionMission(mission, DomainStatuses.Mission.Paused, actorId, "mission.paused", db);
    }

    public async Task ResumeAsync(Guid missionId, Guid actorId, AppDbContext db)
    {
        var mission = await LoadMissionAsync(missionId, db);

        if (!IsStatus(mission.Status, DomainStatuses.Mission.Paused))
        {
            throw new InvalidOperationException("Only paused missions can be resumed.");
        }

        TransitionMission(mission, DomainStatuses.Mission.Active, actorId, "mission.resumed", db);
    }

    public async Task ArchiveAsync(Guid missionId, Guid actorId, AppDbContext db)
    {
        var mission = await LoadMissionAsync(missionId, db);

        if (!IsStatus(mission.Status, DomainStatuses.Mission.Completed) &&
            !IsStatus(mission.Status, DomainStatuses.Mission.Cancelled))
        {
            throw new InvalidOperationException("Only completed or cancelled missions can be archived.");
        }

        TransitionMission(mission, DomainStatuses.Mission.Archived, actorId, "mission.archived", db);

        db.AuditLogs.Add(new Models.Entities.AuditLog
        {
            ActorUserId = actorId,
            Actor = actorId.ToString(),
            Action = "mission.archived",
            Entity = $"mission:{mission.Id}",
            Timestamp = DateTime.UtcNow
        });
    }

    private static async Task<int> MarkMissionCompletedAsync(Guid missionId, AppDbContext db)
    {
        if (IsInMemoryProvider(db))
        {
            return await MarkMissionCompletedInMemoryAsync(missionId, db);
        }

        return await db.Missions
            .Where(mission => mission.Id == missionId && mission.Status != DomainStatuses.Mission.Completed)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(mission => mission.Status, DomainStatuses.Mission.Completed)
                .SetProperty(mission => mission.RowVersion, mission => mission.RowVersion + 1));
    }

    private static async Task<int> MarkMissionCompletedInMemoryAsync(Guid missionId, AppDbContext db)
    {
        if (!InMemoryCompletionClaims.TryAdd(missionId, 0))
        {
            return 0;
        }

        var trackedMission = db.ChangeTracker
            .Entries<Mission>()
            .FirstOrDefault(entry => entry.Entity.Id == missionId)
            ?.Entity;

        var mission = trackedMission ?? await db.Missions.FirstOrDefaultAsync(item => item.Id == missionId);
        if (mission is null)
        {
            InMemoryCompletionClaims.TryRemove(missionId, out _);
            return 0;
        }

        if (IsStatus(mission.Status, DomainStatuses.Mission.Completed))
        {
            return 0;
        }

        mission.Status = DomainStatuses.Mission.Completed;
        mission.RowVersion += 1;
        return 1;
    }

    private static async Task<Mission> LoadMissionAsync(Guid missionId, AppDbContext db)
    {
        var mission = await db.Missions.FirstOrDefaultAsync(item => item.Id == missionId);

        return mission ?? throw new KeyNotFoundException("Mission not found.");
    }

    private static void TransitionMission(
        Mission mission,
        string nextStatus,
        Guid actorId,
        string action,
        AppDbContext db)
    {
        var now = DateTime.UtcNow;
        mission.Status = nextStatus;
        mission.RowVersion += 1;

        AddHistory(db, "Mission", mission.Id, action, actorId, null, now);
    }

    private static void AddHistory(
        AppDbContext db,
        string entityType,
        Guid entityId,
        string action,
        Guid? actorId,
        string? note,
        DateTime now)
    {
        db.EntityHistoryEntries.Add(new EntityHistoryEntry
        {
            Id = Guid.NewGuid(),
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            ActorId = actorId,
            Note = note,
            CreatedAt = now
        });
    }

    private static bool IsApprovedStatus(string status)
    {
        return IsStatus(status, DomainStatuses.Deliverable.Approved) ||
               IsStatus(status, DomainStatuses.Deliverable.Accepted);
    }

    private static bool IsInMemoryProvider(AppDbContext db)
    {
        return string.Equals(db.Database.ProviderName, InMemoryProviderName, StringComparison.Ordinal);
    }

    private static bool IsStatus(string status, string expected)
    {
        return string.Equals(status, expected, StringComparison.OrdinalIgnoreCase);
    }
}
