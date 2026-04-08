namespace InternManager.Api.Services.Interfaces;

public interface ISupervisorScopeService
{
    Task<IReadOnlySet<Guid>> GetAssignedInternIdsAsync(Guid supervisorId, CancellationToken cancellationToken);
}
