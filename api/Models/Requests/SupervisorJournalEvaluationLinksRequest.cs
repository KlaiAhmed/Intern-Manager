using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Requests;

/// <summary>
/// Corps de requête de remplacement des liens critères d évaluation d une entrée de journal.
/// </summary>
public sealed class SupervisorJournalEvaluationLinksRequest
{
    public IReadOnlyList<JournalEvaluationCriteria> Criteria { get; init; } = [];
}
