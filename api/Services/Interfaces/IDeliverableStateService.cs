using InternManager.Api.Data;

namespace InternManager.Api.Services.Interfaces;

public interface IDeliverableStateService
{
    Task OnFirstTaskCreatedAsync(Guid deliverableId, AppDbContext db);

    Task OnTaskAddedWhileInReviewAsync(Guid deliverableId, AppDbContext db);

    Task ReopenApprovedAsync(Guid deliverableId, Guid actorId, string reason, AppDbContext db);
}
