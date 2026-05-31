using InternManager.Api.Common.Constants;

namespace InternManager.Api.Models.Entities;

public sealed class InternTask
{
    public Guid Id { get; set; }

    public Guid InternId { get; set; }

    public Guid? DeliverableId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime? DueDate { get; set; }

    public string Status { get; set; } = DomainStatuses.Task.Todo;

    public DateTime? StatusChangedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? OverdueNotifiedAt { get; set; }

    public int RowVersion { get; set; } = 1;

    public bool IsLegacyAutoTask { get; set; }

    public User? Intern { get; set; }

    public Deliverable? Deliverable { get; set; }

    public bool IsDone => string.Equals(Status, DomainStatuses.Task.Done, StringComparison.OrdinalIgnoreCase);
}
