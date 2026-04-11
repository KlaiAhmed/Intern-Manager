namespace InternManager.Api.Models.Requests;

/// <summary>
/// Corps de requête de création de commentaire superviseur sur entrée de journal.
/// </summary>
public sealed class SupervisorJournalCommentRequest
{
    public string Content { get; init; } = string.Empty;
}
