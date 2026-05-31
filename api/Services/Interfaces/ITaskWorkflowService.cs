namespace InternManager.Api.Services.Interfaces;

public interface ITaskWorkflowService
{
    Task<bool> CanSupervisorAssignInternAsync(Guid supervisorId, Guid internId, CancellationToken cancellationToken);
}
