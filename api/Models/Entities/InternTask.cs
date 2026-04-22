namespace InternManager.Api.Models.Entities;

public sealed class InternTask
{
    public Guid Id { get; set; }

    public Guid InternId { get; set; }

    public Guid? DeliverableId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime? DueDate { get; set; }

    public bool IsComplete { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? Intern { get; set; }

    public Deliverable? Deliverable { get; set; }
}
