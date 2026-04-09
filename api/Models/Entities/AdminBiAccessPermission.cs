namespace InternManager.Api.Models.Entities;

/// <summary>
/// Stores BI dashboard access permission per role and dashboard.
/// </summary>
public sealed class AdminBiAccessPermission
{
    public string Role { get; set; } = string.Empty;

    public string Dashboard { get; set; } = string.Empty;

    public bool Allowed { get; set; }
}
