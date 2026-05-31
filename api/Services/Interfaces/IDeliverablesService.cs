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

    Task<DeliverableReviewResponse> ApproveDeliverableAsync(
        Guid actorId,
        Guid deliverableId,
        int rowVersion,
        CancellationToken cancellationToken);

    Task<DeliverableReviewResponse> RejectDeliverableAsync(
        Guid actorId,
        Guid deliverableId,
        string reason,
        IReadOnlyCollection<Guid> taskIdsToReopen,
        int rowVersion,
        CancellationToken cancellationToken);
}
