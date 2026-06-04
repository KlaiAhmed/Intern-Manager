using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

/// <summary>
/// Handles private supervisor notes scoped to missions they own.
/// </summary>
public sealed class SupervisorMissionNotesService(AppDbContext dbContext) : ISupervisorMissionNotesService
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<NoteResponse>> GetNotesAsync(
        Guid missionId,
        Guid supervisorId,
        CancellationToken cancellationToken)
    {
        await EnsureMissionOwnedAsync(missionId, supervisorId, cancellationToken);

        return await dbContext.SupervisorMissionNotes
            .AsNoTracking()
            .Where(note => note.SupervisorId == supervisorId && note.MissionId == missionId)
            .OrderByDescending(note => note.CreatedAt)
            .Select(note => new NoteResponse
            {
                Id = note.Id,
                MissionId = note.MissionId,
                Content = note.Content,
                CreatedAt = note.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<NoteResponse> CreateNoteAsync(
        Guid missionId,
        Guid supervisorId,
        CreateNoteRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var content = request.Content.Trim();
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ArgumentException("content is required.");
        }

        if (content.Length > 4000)
        {
            throw new ArgumentException("content cannot exceed 4000 characters.");
        }

        await EnsureMissionOwnedAsync(missionId, supervisorId, cancellationToken);

        var note = new SupervisorMissionNote
        {
            Id = Guid.NewGuid(),
            SupervisorId = supervisorId,
            MissionId = missionId,
            Content = content,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.SupervisorMissionNotes.Add(note);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Map(note);
    }

    /// <inheritdoc />
    public async Task<bool> DeleteNoteAsync(
        Guid missionId,
        Guid noteId,
        Guid supervisorId,
        CancellationToken cancellationToken)
    {
        var note = await dbContext.SupervisorMissionNotes
            .FirstOrDefaultAsync(item => item.Id == noteId, cancellationToken);

        if (note is null)
        {
            return false;
        }

        if (note.SupervisorId != supervisorId)
        {
            throw new UnauthorizedAccessException("Supervisor can only delete own notes.");
        }

        if (note.MissionId != missionId)
        {
            return false;
        }

        dbContext.SupervisorMissionNotes.Remove(note);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task EnsureMissionOwnedAsync(
        Guid missionId,
        Guid supervisorId,
        CancellationToken cancellationToken)
    {
        var mission = await dbContext.Missions
            .AsNoTracking()
            .Where(item => item.Id == missionId)
            .Select(item => new { item.SupervisorId })
            .FirstOrDefaultAsync(cancellationToken);

        if (mission is null)
        {
            throw new KeyNotFoundException("Mission not found.");
        }

        if (mission.SupervisorId != supervisorId)
        {
            throw new UnauthorizedAccessException("Supervisor does not own this mission.");
        }
    }

    private static NoteResponse Map(SupervisorMissionNote note)
    {
        return new NoteResponse
        {
            Id = note.Id,
            MissionId = note.MissionId,
            Content = note.Content,
            CreatedAt = note.CreatedAt
        };
    }
}
