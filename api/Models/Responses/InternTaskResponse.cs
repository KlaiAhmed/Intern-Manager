using InternManager.Api.Common.Constants;

namespace InternManager.Api.Models.Responses;

public sealed class InternTaskResponse
{
    public Guid Id { get; init; }

    public Guid InternId { get; init; }

    public Guid? DeliverableId { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Description { get; init; }

    public string Status { get; init; } = DomainStatuses.Task.Todo;

    public int RowVersion { get; init; }

    public DateTime? DueDate { get; init; }

    public DateTime? CompletedAt { get; init; }
}
