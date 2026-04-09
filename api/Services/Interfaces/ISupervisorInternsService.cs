using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

public interface ISupervisorInternsService
{
    Task<IReadOnlyList<InternProgressResponse>> GetInternProgressAsync(
        Guid supervisorId,
        CancellationToken cancellationToken);
}
