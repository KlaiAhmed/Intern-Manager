using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Entities;

public sealed class JournalEvaluationLink
{
    public int JournalEvaluationLinkId { get; set; }

    public Guid JournalEntryId { get; set; }

    public JournalEvaluationCriteria EvaluationCriteria { get; set; }

    public Guid LinkedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public JournalEntry? JournalEntry { get; set; }

    public User? LinkedByUser { get; set; }
}