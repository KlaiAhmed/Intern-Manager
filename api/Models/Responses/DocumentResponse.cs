namespace InternManager.Api.Models.Responses;

public sealed class DocumentResponse
{
    public Guid Id { get; init; }

    public Guid MissionId { get; init; }

    public string FileName { get; init; } = string.Empty;

    public string FileUrl { get; init; } = string.Empty;

    public DateTime UploadedAt { get; init; }

    public string SourceType { get; init; } = string.Empty;
}
