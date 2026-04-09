namespace InternManager.Api.Models.Entities;

/// <summary>
/// Stores annual archive trigger history for admin operations.
/// </summary>
public sealed class AdminArchiveJob
{
    public Guid Id { get; set; }

    public int Year { get; set; }

    public string TriggeredBy { get; set; } = string.Empty;

    public DateTime TriggeredAt { get; set; }

    public string Status { get; set; } = string.Empty;
}
