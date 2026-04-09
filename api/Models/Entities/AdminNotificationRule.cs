namespace InternManager.Api.Models.Entities;

/// <summary>
/// Configurable notification rule for admin operations.
/// </summary>
public sealed class AdminNotificationRule
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Trigger { get; set; } = string.Empty;

    public bool Enabled { get; set; }
}
