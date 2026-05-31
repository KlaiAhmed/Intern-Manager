using InternManager.Api.Data;

namespace InternManager.Api.Services.Interfaces;

public interface IMissionProgressService
{
    Task RecalculateAsync(Guid missionId, AppDbContext db);
}
