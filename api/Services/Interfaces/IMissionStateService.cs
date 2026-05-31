using InternManager.Api.Data;

namespace InternManager.Api.Services.Interfaces;

public interface IMissionStateService
{
    Task CheckCompletionAsync(Guid missionId, AppDbContext db);

    Task PauseAsync(Guid missionId, Guid actorId, AppDbContext db);

    Task ResumeAsync(Guid missionId, Guid actorId, AppDbContext db);

    Task ArchiveAsync(Guid missionId, Guid actorId, AppDbContext db);
}
