namespace InternManager.Api.Models.Requests;

public sealed class UpdateDeliverableRequest
{
    public string? Title { get; init; }

    public string? Description { get; init; }

    public DateTime? DueDate { get; init; }
}
