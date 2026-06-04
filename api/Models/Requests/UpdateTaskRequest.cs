namespace InternManager.Api.Models.Requests;

public sealed class UpdateTaskRequest
{
    public string? Title { get; init; }

    public string? Description { get; init; }

    public DateTime? DueDate { get; init; }

    public Guid? DeliverableId { get; init; }
}
