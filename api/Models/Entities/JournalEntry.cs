namespace InternManager.Api.Models.Entities;

public sealed class JournalEntry
{
    public Guid Id { get; set; }

    public Guid InternId { get; set; }

    public string Content { get; set; } = string.Empty;

    public bool IsReviewed { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? Intern { get; set; }

    public ICollection<JournalComment> Comments { get; set; } = new List<JournalComment>();

    public ICollection<JournalEvaluationLink> EvaluationLinks { get; set; } = new List<JournalEvaluationLink>();
}
