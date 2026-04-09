namespace InternManager.Api.Models.Responses;

public sealed class InternProgressResponse
{
    public Guid InternId { get; init; }

    public string FullName { get; init; } = string.Empty;

    public string MissionTitle { get; init; } = string.Empty;

    public string StageType { get; init; } = string.Empty;

    public int Progress { get; init; }

    public string Status { get; init; } = string.Empty;

    public bool IsLate { get; init; }
}
