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
            .Select(deliverable => deliverable.RawProgress)
            .ToListAsync();

        var rawProgress = CalculateRawProgress(deliverables);

        mission.RawProgress = rawProgress;
        mission.RowVersion += 1;
    }

    private static decimal CalculateRawProgress(IEnumerable<decimal> deliverableProgresses)
    {
        var progressList = deliverableProgresses.ToList();
        if (progressList.Count == 0)
        {
            return 0m;
        }

        var rawProgress = progressList.Sum() / progressList.Count;
        return Math.Round(rawProgress, 2, MidpointRounding.AwayFromZero);
    }
}
