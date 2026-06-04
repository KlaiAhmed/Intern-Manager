using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

public interface ISupervisorStatsService
{
    Task<double> GetAverageProgressAsync(Guid supervisorId, CancellationToken cancellationToken);

    Task<AvgValidationDelayResponse> GetAverageValidationDelayAsync(Guid supervisorId, CancellationToken cancellationToken);

    Task<SupervisorWorkloadResponse> GetWorkloadAsync(Guid supervisorId, CancellationToken cancellationToken);

    Task<DelaysAlertsResponse> GetDelaysAlertsAsync(Guid supervisorId, CancellationToken cancellationToken);

    Task<MissionProgressResponse> GetMissionProgressAsync(
        Guid missionId,
        Guid supervisorId,
        bool isAdminScope,
        CancellationToken cancellationToken);
}
