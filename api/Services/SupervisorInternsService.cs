using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class SupervisorInternsService(
    AppDbContext dbContext,
    ISupervisorScopeService supervisorScopeService) : ISupervisorInternsService
{
    public async Task<IReadOnlyList<InternProgressResponse>> GetInternProgressAsync(
        Guid supervisorId,
        CancellationToken cancellationToken)
    {
        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(supervisorId, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return [];
        }

        var interns = await dbContext.Users
            .AsNoTracking()
            .Where(user => assignedInternIds.Contains(user.Id))
            .OrderBy(user => user.FirstName)
            .ThenBy(user => user.LastName)
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName
            })
            .ToListAsync(cancellationToken);

        if (interns.Count == 0)
        {
            return [];
        }

        var internIdList = interns.Select(item => item.Id).ToList();

        var activeMissionRows = await (
                from assignment in dbContext.MissionInternAssignments.AsNoTracking()
                join mission in dbContext.Missions.AsNoTracking() on assignment.MissionId equals mission.Id
                where mission.SupervisorId == supervisorId &&
                      internIdList.Contains(assignment.InternId) &&
                      mission.Status == DomainStatuses.Mission.Active
                select new
                {
                    InternId = assignment.InternId,
                    MissionId = mission.Id,
                    MissionTitle = mission.Title,
                    mission.CreatedAt,
                    StageType = mission.InternshipType != null ? mission.InternshipType.Name : null
                })
            .Union(
                dbContext.Missions
                    .AsNoTracking()
                    .Where(mission => mission.SupervisorId == supervisorId &&
                                      mission.InternId.HasValue &&
                                      internIdList.Contains(mission.InternId.Value) &&
                                      mission.Status == DomainStatuses.Mission.Active)
                    .Select(mission => new
                    {
                        InternId = mission.InternId!.Value,
                        MissionId = mission.Id,
                        MissionTitle = mission.Title,
                        mission.CreatedAt,
                        StageType = mission.InternshipType != null ? mission.InternshipType.Name : null
                    }))
            .ToListAsync(cancellationToken);

        var latestMissionByIntern = activeMissionRows
            .GroupBy(item => item.InternId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(item => item.CreatedAt).First());

        var missionIds = latestMissionByIntern.Values
            .Select(item => item.MissionId)
            .Distinct()
            .ToList();

        var deliverableRows = missionIds.Count == 0
            ? []
            : await dbContext.Deliverables
                .AsNoTracking()
                .Where(deliverable => missionIds.Contains(deliverable.MissionId))
                .Select(deliverable => new
                {
                    deliverable.MissionId,
                    deliverable.Progress,
                    deliverable.Status,
                    deliverable.DueDate
                })
                .ToListAsync(cancellationToken);

        var deliverablesByMission = deliverableRows
            .GroupBy(item => item.MissionId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var utcNow = DateTime.UtcNow;
        var atRiskThreshold = utcNow.AddDays(3);
        var responses = new List<InternProgressResponse>(interns.Count);

        foreach (var intern in interns)
        {
            latestMissionByIntern.TryGetValue(intern.Id, out var mission);

            var missionDeliverables = mission is not null && deliverablesByMission.TryGetValue(mission.MissionId, out var items)
                ? items
                : [];

            var progress = missionDeliverables.Count == 0
                ? 0
                : (int)Math.Round(missionDeliverables.Average(item => (double)Math.Clamp(item.Progress, 0, 100)));

            var hasLateDeliverable = missionDeliverables.Any(item =>
                item.DueDate.HasValue &&
                item.DueDate.Value < utcNow &&
                IsNotAcceptedOrRejected(item.Status));

            var hasAtRiskDeliverable = !hasLateDeliverable && missionDeliverables.Any(item =>
                item.DueDate.HasValue &&
                item.DueDate.Value >= utcNow &&
                item.DueDate.Value <= atRiskThreshold &&
                IsNotAcceptedOrRejected(item.Status));

            var status = hasLateDeliverable
                ? "LATE"
                : hasAtRiskDeliverable
                    ? "AT_RISK"
                    : "ON_TRACK";

            responses.Add(new InternProgressResponse
            {
                InternId = intern.Id,
                FullName = $"{intern.FirstName} {intern.LastName}".Trim(),
                MissionTitle = mission?.MissionTitle ?? string.Empty,
                MissionId = mission?.MissionId,
                StageType = string.IsNullOrWhiteSpace(mission?.StageType)
                    ? "OTHER"
                    : mission.StageType.Trim().ToUpperInvariant(),
                Progress = progress,
                Status = status,
                IsLate = hasLateDeliverable
            });
        }

        return responses;
    }

    private static bool IsNotAcceptedOrRejected(string rawStatus)
    {
        var normalizedStatus = rawStatus.Trim().ToLowerInvariant();
        return normalizedStatus is not DomainStatuses.Deliverable.Accepted and not DomainStatuses.Deliverable.Rejected;
    }
}
