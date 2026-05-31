using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class DeliverableProgressService(IMissionProgressService missionProgressService) : IDeliverableProgressService
{
    public async Task RecalculateAsync(Guid deliverableId, AppDbContext db)
    {
        var deliverable = await db.Deliverables.FindAsync(deliverableId);
        if (deliverable is null)
        {
            return;
        }

        var taskStatuses = await db.InternTasks
            .Where(task => task.DeliverableId == deliverableId &&
                           task.Status != DomainStatuses.Task.Cancelled)
            .Select(task => task.Status)
            .ToListAsync();

        var rawProgress = CalculateRawProgress(taskStatuses);

        var currentRowVersion = deliverable.RowVersion;
        deliverable.RawProgress = rawProgress;
        deliverable.RowVersion = currentRowVersion + 1;

        await RecalculateMissionAsync(deliverable.MissionId, db);
    }

    private Task RecalculateMissionAsync(Guid missionId, AppDbContext db)
    {
        return missionProgressService.RecalculateAsync(missionId, db);
    }

    private static decimal CalculateRawProgress(IReadOnlyCollection<string> taskStatuses)
    {
        if (taskStatuses.Count == 0)
        {
            return 0m;
        }

        var doneCount = taskStatuses.Count(status => status == DomainStatuses.Task.Done);
        var rawProgress = (decimal)doneCount / taskStatuses.Count * 100m;
        return Math.Round(rawProgress, 2, MidpointRounding.AwayFromZero);
    }
}
