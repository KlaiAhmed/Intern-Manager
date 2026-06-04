using System.Text.Json.Serialization;

namespace InternManager.Api.Models.Requests;

public sealed class UploadDocumentRequest
{
    [JsonIgnore]
    public IFormFile? File { get; init; }

    public string? Url { get; init; }

    public string? Label { get; init; }
}
