using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Service for intern read-only access to mission documents assigned to their mission.
/// Supervisor/admin/superadmin document flows remain on <see cref="IMissionDocumentsService"/>.
/// </summary>
public interface IInternMissionDocumentsService
{
    /// <summary>
    /// Returns all documents attached to a mission the intern is assigned to, newest first.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="internId">Intern user id (must match mission assignment).</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The documents attached to the mission.</returns>
    /// <exception cref="KeyNotFoundException">Thrown when the mission does not exist or the intern is not assigned to it.</exception>
    Task<IReadOnlyList<DocumentResponse>> GetDocumentsAsync(
        Guid missionId,
        Guid internId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Resolves a streaming file result for the requested mission document.
    /// </summary>
    /// <param name="missionId">Unique mission identifier.</param>
    /// <param name="documentId">Unique document identifier.</param>
    /// <param name="internId">Intern user id (must match mission assignment).</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The file payload for the document, or <c>null</c> if the file is not on disk or the document is not a file-type document.</returns>
    /// <exception cref="KeyNotFoundException">Thrown when the mission does not exist, the intern is not assigned to it, or the document is not part of the mission.</exception>
    Task<InternMissionDocumentDownload?> GetDownloadAsync(
        Guid missionId,
        Guid documentId,
        Guid internId,
        CancellationToken cancellationToken);
}

/// <summary>
/// File payload returned by <see cref="IInternMissionDocumentsService.GetDownloadAsync"/>.
/// </summary>
public sealed record InternMissionDocumentDownload(
    Stream Content,
    string FileName,
    string ContentType,
    long Length);
