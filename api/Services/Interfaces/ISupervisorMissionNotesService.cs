using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

/// <summary>
/// Service for private mission notes owned by the current supervisor.
/// </summary>
public interface ISupervisorMissionNotesService
{
    /// <summary>
    /// Gets all notes for an owned mission, newest first.
    /// </summary>
    Task<IReadOnlyList<NoteResponse>> GetNotesAsync(
        Guid missionId,
        Guid supervisorId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Creates a private note for an owned mission.
    /// </summary>
    Task<NoteResponse> CreateNoteAsync(
        Guid missionId,
        Guid supervisorId,
        CreateNoteRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes a private note owned by the supervisor.
    /// </summary>
    Task<bool> DeleteNoteAsync(
        Guid missionId,
        Guid noteId,
        Guid supervisorId,
        CancellationToken cancellationToken);
}
