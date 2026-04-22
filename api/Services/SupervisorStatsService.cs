using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class SupervisorStatsService(
    AppDbContext dbContext,
    ISupervisorScopeService supervisorScopeService) : ISupervisorStatsService
{
    public async Task<double> GetAverageProgressAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var deliverableProgressValues = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId)
            .Select(deliverable => deliverable.Progress)
            .ToListAsync(cancellationToken);

        var averageProgress = deliverableProgressValues.Count == 0
            ? 0d
            : deliverableProgressValues.Average(progress => Math.Clamp(progress, 0, 100));

return Math.Round(averageProgress, 2);
 }

 public async Task<AvgValidationDelayResponse> GetAverageValidationDelayAsync(
 Guid supervisorId,
 CancellationToken cancellationToken)
 {
 // Uses calendar month boundaries (1st to last day of month in UTC).
 // If business-specific month boundaries are needed, this should be made configurable.
        var utcNow = DateTime.UtcNow;
        var monthStart = new DateTime(utcNow.Year, utcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        var delaySamples = await dbContext.DeliverableVersions
            .AsNoTracking()
            .Where(version => version.Deliverable != null &&
                              version.Deliverable.SupervisorId == supervisorId &&
                              version.ValidatedAt.HasValue &&
                              version.ValidatedAt.Value >= monthStart &&
                              version.ValidatedAt.Value < monthEnd)
            .Select(version => new
            {
                version.DeliverableId,
                version.VersionNumber,
                version.SubmittedAt,
                ValidatedAt = version.ValidatedAt!.Value
            })
            .ToListAsync(cancellationToken);

        var latestValidatedSamples = delaySamples
            .GroupBy(sample => sample.DeliverableId)
            .Select(group => group
                .OrderByDescending(sample => sample.VersionNumber)
                .First())
            .ToList();

        var delaysInDays = latestValidatedSamples
            .Select(sample => (sample.ValidatedAt - sample.SubmittedAt).TotalDays)
            .Where(days => days >= 0d)
            .ToList();

        if (delaysInDays.Count == 0)
        {
            return new AvgValidationDelayResponse
            {
                Days = 0d,
                SampleSize = 0
            };
        }

        return new AvgValidationDelayResponse
        {
            Days = Math.Round(delaysInDays.Average(), 1),
            SampleSize = delaysInDays.Count
        };
    }

    public async Task<SupervisorWorkloadResponse> GetWorkloadAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(supervisorId, cancellationToken);

        var activeInternIds = assignedInternIds.Count == 0
            ? []
            : await dbContext.Users
                .AsNoTracking()
                .Where(user => assignedInternIds.Contains(user.Id) &&
                               user.Role == UserRole.Intern &&
                               user.Status == UserStatus.Active)
                .Select(user => user.Id)
                .ToListAsync(cancellationToken);

        var maxCapacity = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == supervisorId && user.Role == UserRole.Supervisor)
            .Select(user => user.MaxCapacity)
            .FirstOrDefaultAsync(cancellationToken);

        var missionTypeRows = activeInternIds.Count == 0
            ? []
            : await (
                from assignment in dbContext.MissionInternAssignments.AsNoTracking()
                join mission in dbContext.Missions.AsNoTracking() on assignment.MissionId equals mission.Id
                where mission.SupervisorId == supervisorId &&
                      activeInternIds.Contains(assignment.InternId) &&
                      mission.Status == DomainStatuses.Mission.Active
                select new
                {
                    InternId = assignment.InternId,
                    mission.CreatedAt,
                    TypeName = mission.InternshipType != null ? mission.InternshipType.Name : null
                })
                .Union(
                    dbContext.Missions
                        .AsNoTracking()
                        .Where(mission => mission.SupervisorId == supervisorId &&
                                          mission.InternId.HasValue &&
                                          activeInternIds.Contains(mission.InternId.Value) &&
                                          mission.Status == DomainStatuses.Mission.Active)
                        .Select(mission => new
                        {
                            InternId = mission.InternId!.Value,
                            mission.CreatedAt,
                            TypeName = mission.InternshipType != null ? mission.InternshipType.Name : null
                        }))
                .ToListAsync(cancellationToken);

        var latestTypeByIntern = missionTypeRows
            .GroupBy(item => item.InternId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.CreatedAt)
                    .Select(item => item.TypeName)
                    .FirstOrDefault());

        var pfeCount = 0;
        var summerCount = 0;
        var otherCount = 0;

        foreach (var internId in activeInternIds)
        {
            if (!latestTypeByIntern.TryGetValue(internId, out var typeName) || string.IsNullOrWhiteSpace(typeName))
            {
                otherCount++;
                continue;
            }

            if (string.Equals(typeName, "PFE", StringComparison.OrdinalIgnoreCase))
            {
                pfeCount++;
            }
            else if (string.Equals(typeName, "SUMMER", StringComparison.OrdinalIgnoreCase))
            {
                summerCount++;
            }
            else
            {
                otherCount++;
            }
        }

        int? utilizationPercent = null;
        if (maxCapacity.HasValue)
        {
            utilizationPercent = maxCapacity.Value > 0
                ? (int)Math.Round((double)activeInternIds.Count / maxCapacity.Value * 100d, MidpointRounding.AwayFromZero)
                : 0;
        }

        return new SupervisorWorkloadResponse
        {
            CurrentInternCount = activeInternIds.Count,
            MaxCapacity = maxCapacity,
            UtilizationPercent = utilizationPercent,
            PfeCount = pfeCount,
            SummerCount = summerCount,
            OtherCount = otherCount
        };
    }

    public async Task<DelaysAlertsResponse> GetDelaysAlertsAsync(Guid supervisorId, CancellationToken cancellationToken)
    {
        var assignedInternIds = await supervisorScopeService.GetAssignedInternIdsAsync(supervisorId, cancellationToken);
        if (assignedInternIds.Count == 0)
        {
            return new DelaysAlertsResponse();
        }

        var utcNow = DateTime.UtcNow;

        var lateDeliverables = await dbContext.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.SupervisorId == supervisorId &&
                                  deliverable.InternId.HasValue &&
                                  assignedInternIds.Contains(deliverable.InternId.Value) &&
                                  deliverable.DueDate.HasValue &&
                                  deliverable.DueDate.Value < utcNow &&
                                  deliverable.Status != DomainStatuses.Deliverable.Accepted &&
                                  deliverable.Status != DomainStatuses.Deliverable.Rejected)
            .Select(deliverable => new
            {
                deliverable.Id,
                deliverable.Title,
                InternId = deliverable.InternId!.Value,
                InternFirstName = deliverable.Intern != null ? deliverable.Intern.FirstName : string.Empty,
                InternLastName = deliverable.Intern != null ? deliverable.Intern.LastName : string.Empty,
                DueDate = deliverable.DueDate!.Value
            })
            .ToListAsync(cancellationToken);

        var data = lateDeliverables
            .Select(item =>
            {
                var daysOverdue = (int)(utcNow - item.DueDate).TotalDays;
                return new DelayAlertItemResponse
                {
                    InternId = item.InternId,
                    InternName = $"{item.InternFirstName} {item.InternLastName}".Trim(),
                    DeliverableId = item.Id,
                    DeliverableTitle = item.Title,
                    DueDate = item.DueDate,
                    DaysOverdue = daysOverdue,
                    Severity = daysOverdue >= 7 ? "CRITICAL" : "MODERATE"
                };
            })
            .OrderByDescending(item => item.DaysOverdue)
            .ToList();

        return new DelaysAlertsResponse
        {
            Data = data,
            Total = data.Count
        };
    }
}
