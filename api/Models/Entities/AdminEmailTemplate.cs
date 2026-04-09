namespace InternManager.Api.Models.Entities;

/// <summary>
/// Editable email template for admin communication workflows.
/// </summary>
public sealed class AdminEmailTemplate
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;
}
