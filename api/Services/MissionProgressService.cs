using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class MissionProgressService : IMissionProgressService
{
    public async Task RecalculateAsync(Guid missionId, AppDbContext db)
    {
        var mission = await db.Missions.FindAsync(missionId);
        if (mission is null)
        {
            return;
        }

        var deliverables = await db.Deliverables
            .Where(deliverable => deliverable.MissionId == missionId &&
                                  deliverable.Status != DomainStatuses.Deliverable.Cancelled)
            .Select(deliverable => new { deliverable.RawProgress, deliverable.Weight })
            .ToListAsync();

        var rawProgress = CalculateRawProgress(deliverables.Select(item => (item.RawProgress, item.Weight)));

        mission.RawProgress = rawProgress;
        mission.RowVersion += 1;
    }

    private static decimal CalculateRawProgress(IEnumerable<(decimal RawProgress, decimal Weight)> deliverables)
    {
        var deliverableList = deliverables.ToList();
        if (deliverableList.Count == 0)
        {
            return 0m;
        }

        var totalWeight = deliverableList.Sum(deliverable => deliverable.Weight);
        if (totalWeight == 0m)
        {
            totalWeight = 1m;
        }

        var rawProgress = deliverableList.Sum(deliverable => deliverable.RawProgress * deliverable.Weight) / totalWeight;
        return Math.Round(rawProgress, 2, MidpointRounding.AwayFromZero);
    }
}
