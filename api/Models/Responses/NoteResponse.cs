namespace InternManager.Api.Models.Responses;

/// <summary>
/// Private supervisor note attached to a mission.
/// </summary>
public sealed class NoteResponse
{
    public Guid Id { get; init; }

    public Guid MissionId { get; init; }

    public string Content { get; init; } = string.Empty;

    public DateTime CreatedAt { get; init; }
}
