using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Responses;

/// <summary>
/// Représente une entrée de journal enrichie pour la supervision.
/// </summary>
public sealed class SupervisorJournalEntryResponse
{
    public Guid Id { get; init; }

    public Guid InternId { get; init; }

    public string Content { get; init; } = string.Empty;

    public bool IsReviewed { get; init; }

    public DateTime CreatedAt { get; init; }

    public IReadOnlyList<SupervisorJournalCommentResponse> Comments { get; init; } = [];

    public IReadOnlyList<SupervisorJournalEvaluationLinkResponse> EvaluationLinks { get; init; } = [];
}

/// <summary>
/// Représente un commentaire de supervision sur une entrée de journal.
/// </summary>
public sealed class SupervisorJournalCommentResponse
{
    public int JournalCommentId { get; init; }

    public Guid AuthorId { get; init; }

    public string Content { get; init; } = string.Empty;

    public DateTime CreatedAt { get; init; }
}

/// <summary>
/// Représente un lien entre une entrée de journal et un critère d évaluation.
/// </summary>
public sealed class SupervisorJournalEvaluationLinkResponse
{
    public int JournalEvaluationLinkId { get; init; }

    public JournalEvaluationCriteria Criteria { get; init; }

    public Guid LinkedByUserId { get; init; }

    public DateTime CreatedAt { get; init; }
}
