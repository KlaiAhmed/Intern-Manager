namespace InternManager.Api.Models.Requests;

public sealed class SubmitDeliverableRequest
{
    public string? FileUrl { get; set; }

    public string? GitHubUrl { get; set; }

    public string? GitHubBranch { get; set; }

    public string? Message { get; set; }

    public int RowVersion { get; set; }
}
