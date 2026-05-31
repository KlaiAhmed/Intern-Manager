namespace InternManager.Api.Models.Responses;

public sealed class DeliverableQueueItemResponse
{
    public Guid Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public Guid? InternId { get; init; }

    public string InternName { get; init; } = string.Empty;

    public DateTime? SubmittedDate { get; init; }

    public DateTime? DueDate { get; init; }

    public string Status { get; init; } = string.Empty;

    public int Version { get; init; }

    public string FileUrl { get; init; } = string.Empty;

    public int RowVersion { get; init; }

    public decimal RawProgress { get; init; }

    public IReadOnlyList<DeliverableQueueTaskResponse> Tasks { get; init; } = [];
}

public sealed class DeliverableValidationResponse
{
    public Guid Id { get; init; }

    public string Status { get; init; } = string.Empty;
}

public sealed class DeliverableQueueTaskResponse
{
    public Guid Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public int RowVersion { get; init; }
}

public sealed class DeliverableReviewResponse
{
    public Guid Id { get; init; }

    public string Status { get; init; } = string.Empty;

    public int RowVersion { get; init; }

    public decimal RawProgress { get; init; }
}
