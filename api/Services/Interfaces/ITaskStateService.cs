using InternManager.Api.Data;

namespace InternManager.Api.Services.Interfaces;

public interface ITaskStateService
{
    Task MarkDoneAsync(Guid taskId, Guid actorId, int expectedRowVersion, bool isSupervisorOverride, AppDbContext db);

    Task RevertToTodoAsync(Guid taskId, Guid actorId, int expectedRowVersion, AppDbContext db);

    Task ReopenAsync(Guid taskId, Guid actorId, int expectedRowVersion, string reason, AppDbContext db);
}
