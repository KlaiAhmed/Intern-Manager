namespace InternManager.Api.Models.Requests;

public sealed class UpdateTaskStatusRequest
{
    public string Status { get; init; } = string.Empty;

    public int RowVersion { get; init; }
}
