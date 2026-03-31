using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

public interface IInternshipsService
{
    Task<PagedResponse<InternshipResponse>> GetAllAsync(
        string? status,
        string? department,
        string? supervisorId,
        int page,
        int limit,
        CancellationToken cancellationToken = default);

    Task<InternshipResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<InternshipResponse> CreateAsync(CreateInternshipRequest request, CancellationToken cancellationToken = default);

    Task<InternshipResponse> UpdateAsync(Guid id, UpdateInternshipRequest request, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
