namespace InternManager.Api.Models.Entities;

public sealed class Evaluation
{
    public Guid Id { get; set; }

    public Guid SupervisorId { get; set; }

    public Guid InternId { get; set; }

    public string Type { get; set; } = string.Empty;

    public int Technical { get; set; }

    public int Autonomy { get; set; }

    public int Communication { get; set; }

    public int DeadlineRespect { get; set; }

    public int DeliverableQuality { get; set; }

    public string Comments { get; set; } = string.Empty;

    public string Status { get; set; } = "pending";

    public bool IsReleasedToIntern { get; set; }

    public DateTime? ReleasedAt { get; set; }

    public Guid? ReleasedByUserId { get; set; }

    public DateTime? SubmittedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? Supervisor { get; set; }

    public User? Intern { get; set; }

    public User? ReleasedByUser { get; set; }
}
