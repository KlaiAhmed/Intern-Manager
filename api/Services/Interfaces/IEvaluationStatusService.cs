using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

public interface IEvaluationStatusService
{
    Task<EvaluationStatusResponse> GetSupervisorEvaluationStatusAsync(
        Guid supervisorId,
        CancellationToken cancellationToken);
}
