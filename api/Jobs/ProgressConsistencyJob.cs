using InternManager.Api.Common.Constants;
using InternManager.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Jobs;

public sealed class ProgressConsistencyJob(
    IServiceScopeFactory scopeFactory,
    ILogger<ProgressConsistencyJob> logger) : IHostedService, IDisposable
{
    private static readonly TimeSpan RunTimeUtc = TimeSpan.FromHours(2);
    private CancellationTokenSource? stoppingTokenSource;
    private Task? executingTask;
    private PeriodicTimer? timer;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        stoppingTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        executingTask = ExecuteAsync(stoppingTokenSource.Token);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (stoppingTokenSource is null)
        {
            return;
        }

        await stoppingTokenSource.CancelAsync();

        if (executingTask is not null)
        {
            await Task.WhenAny(executingTask, Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken));
        }
    }

    public async Task RunOnceAsync(CancellationToken cancellationToken = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var correctedDeliverables = await CorrectDeliverablesAsync(db, cancellationToken);
        var correctedMissions = await CorrectMissionsAsync(db, cancellationToken);

        logger.LogInformation(
            "Consistency job: {DeliverablesCorrected} deliverables corrected, {MissionsCorrected} missions corrected",
            correctedDeliverables,
            correctedMissions);
    }

    public void Dispose()
    {
        timer?.Dispose();
        stoppingTokenSource?.Dispose();
    }

    private async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await RunOnceAsync(stoppingToken);

            var initialDelay = GetDelayUntilNextRun(DateTimeOffset.UtcNow);
            if (initialDelay > TimeSpan.Zero)
            {
                await Task.Delay(initialDelay, stoppingToken);
            }

            await RunOnceAsync(stoppingToken);

            timer = new PeriodicTimer(TimeSpan.FromDays(1));
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunOnceAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Progress consistency job stopped unexpectedly.");
        }
    }

    private static TimeSpan GetDelayUntilNextRun(DateTimeOffset utcNow)
    {
        var nextRun = new DateTimeOffset(
            utcNow.Year,
            utcNow.Month,
            utcNow.Day,
            RunTimeUtc.Hours,
            RunTimeUtc.Minutes,
            0,
            TimeSpan.Zero);

        if (nextRun <= utcNow)
        {
            nextRun = nextRun.AddDays(1);
        }

        return nextRun - utcNow;
    }

    private async Task<int> CorrectDeliverablesAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        const int batchSize = 100;
        var corrected = 0;
        var page = 0;

        while (true)
        {
            var deliverableIds = await db.Deliverables
                .AsNoTracking()
                .Where(deliverable => deliverable.Status != DomainStatuses.Deliverable.Cancelled)
                .OrderBy(deliverable => deliverable.Id)
                .Skip(page * batchSize)
                .Take(batchSize)
                .Select(deliverable => deliverable.Id)
                .ToListAsync(cancellationToken);

            if (deliverableIds.Count == 0)
            {
                break;
            }

            foreach (var deliverableId in deliverableIds)
            {
                try
                {
                    corrected += await CorrectDeliverableAsync(db, deliverableId, cancellationToken);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    logger.LogError(exception, "Failed to correct progress for deliverable {DeliverableId}.", deliverableId);
                    db.ChangeTracker.Clear();
                }
            }

            page++;
        }

        return corrected;
    }

    private async Task<int> CorrectMissionsAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var missionIds = await db.Missions
            .AsNoTracking()
            .Where(mission => mission.Status != DomainStatuses.Mission.Archived)
            .OrderBy(mission => mission.Id)
            .Select(mission => mission.Id)
            .ToListAsync(cancellationToken);

        var corrected = 0;
        foreach (var missionId in missionIds)
        {
            try
            {
                corrected += await CorrectMissionAsync(db, missionId, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Failed to correct progress for mission {MissionId}.", missionId);
                db.ChangeTracker.Clear();
            }
        }

        return corrected;
    }

    private async Task<int> CorrectDeliverableAsync(AppDbContext db, Guid deliverableId, CancellationToken cancellationToken)
    {
        var deliverable = await db.Deliverables.FindAsync([deliverableId], cancellationToken);
        if (deliverable is null)
        {
            return 0;
        }

        var taskStatuses = await db.InternTasks
            .AsNoTracking()
            .Where(task => task.DeliverableId == deliverableId &&
                           task.Status != DomainStatuses.Task.Cancelled)
            .Select(task => task.Status)
            .ToListAsync(cancellationToken);

        var computedRawProgress = CalculateDeliverableRawProgress(taskStatuses);
        if (Math.Round(deliverable.RawProgress, 2, MidpointRounding.AwayFromZero) == computedRawProgress)
        {
            db.ChangeTracker.Clear();
            return 0;
        }

        var previousRawProgress = deliverable.RawProgress;
        deliverable.RawProgress = computedRawProgress;
        deliverable.RowVersion += 1;

        await db.SaveChangesAsync(cancellationToken);
        logger.LogWarning(
            "Corrected deliverable {DeliverableId} raw progress from {StoredRawProgress} to {ComputedRawProgress}.",
            deliverableId,
            previousRawProgress,
            computedRawProgress);

        db.ChangeTracker.Clear();
        return 1;
    }

    private async Task<int> CorrectMissionAsync(AppDbContext db, Guid missionId, CancellationToken cancellationToken)
    {
        var mission = await db.Missions.FindAsync([missionId], cancellationToken);
        if (mission is null)
        {
            return 0;
        }

        var deliverables = await db.Deliverables
            .AsNoTracking()
            .Where(deliverable => deliverable.MissionId == missionId &&
                                  deliverable.Status != DomainStatuses.Deliverable.Cancelled)
            .Select(deliverable => deliverable.RawProgress)
            .ToListAsync(cancellationToken);

        var computedRawProgress = CalculateMissionRawProgress(deliverables);

        if (Math.Round(mission.RawProgress, 2, MidpointRounding.AwayFromZero) == computedRawProgress)
        {
            db.ChangeTracker.Clear();
            return 0;
        }

        var previousRawProgress = mission.RawProgress;
        mission.RawProgress = computedRawProgress;
        mission.RowVersion += 1;

        await db.SaveChangesAsync(cancellationToken);
        logger.LogWarning(
            "Corrected mission {MissionId} raw progress from {StoredRawProgress} to {ComputedRawProgress}.",
            missionId,
            previousRawProgress,
            computedRawProgress);

        db.ChangeTracker.Clear();
        return 1;
    }

    private static decimal CalculateDeliverableRawProgress(IReadOnlyCollection<string> taskStatuses)
    {
        if (taskStatuses.Count == 0)
        {
            return 0m;
        }

        var doneCount = taskStatuses.Count(status => status == DomainStatuses.Task.Done);
        return Math.Round((decimal)doneCount / taskStatuses.Count * 100m, 2, MidpointRounding.AwayFromZero);
    }

    private static decimal CalculateMissionRawProgress(IEnumerable<decimal> deliverableProgresses)
    {
        var progressList = deliverableProgresses.ToList();
        if (progressList.Count == 0)
        {
            return 0m;
        }

        return Math.Round(progressList.Sum() / progressList.Count, 2, MidpointRounding.AwayFromZero);
    }
}
