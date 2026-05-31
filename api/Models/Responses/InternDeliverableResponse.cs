namespace InternManager.Api.Models.Responses;

public sealed class InternDeliverableResponse
{
    public Guid Id { get; init; }

    public Guid MissionId { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public int Version { get; init; }

    public string? SupervisorComment { get; init; }

    public int Progress { get; init; }

    public decimal Weight { get; init; }

    public int RowVersion { get; init; }

    public DateTime? DueDate { get; init; }
}
