using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

public interface IDeliverablesService
{
    Task<PagedResponse<DeliverableQueueItemResponse>> GetSupervisorDeliverablesAsync(
        Guid supervisorId,
        string? status,
        int page,
        int limit,
        CancellationToken cancellationToken);

    Task<DeliverableValidationResponse> ValidateDeliverableAsync(
        Guid supervisorId,
        Guid deliverableId,
        string? status,
        string? action,
        string? comment,
        string actorName,
        CancellationToken cancellationToken);
}
