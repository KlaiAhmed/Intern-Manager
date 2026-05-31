using InternManager.Api.Data;

namespace InternManager.Api.Services.Interfaces;

public interface IDeliverableProgressService
{
    Task RecalculateAsync(Guid deliverableId, AppDbContext db);
}
