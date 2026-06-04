using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Service for supervisor-owned documents attached to missions.
/// </summary>
public interface IMissionDocumentsService
{
    /// <summary>
    /// Creates a mission document from either an uploaded file or an HTTPS URL.
    /// </summary>
    Task<DocumentResponse> UploadDocumentAsync(
        Guid missionId,
        Guid supervisorId,
        UploadDocumentRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Returns all documents for a supervisor-owned mission.
    /// </summary>
    Task<IReadOnlyList<DocumentResponse>> GetDocumentsAsync(
        Guid missionId,
        Guid supervisorId,
        CancellationToken cancellationToken);
}
