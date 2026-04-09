namespace InternManager.Api.Models.Requests;

public sealed class UpdateAdminEmailTemplateRequest
{
    public string Name { get; init; } = string.Empty;

    public string Subject { get; init; } = string.Empty;

    public string Body { get; init; } = string.Empty;
}
