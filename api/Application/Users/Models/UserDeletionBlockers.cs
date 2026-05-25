namespace InternManager.Api.Application.Users.Models;

public sealed class UserDeletionBlockers
{
    public int MissionsAsSupervisor { get; init; }

    public int DeliverablesAsSupervisor { get; init; }

    public int Evaluations { get; init; }

    public int Meetings { get; init; }

    public int JournalComments { get; init; }

    public int JournalEvaluationLinks { get; init; }

    public bool HasBlockers =>
        MissionsAsSupervisor > 0 ||
        DeliverablesAsSupervisor > 0 ||
        Evaluations > 0 ||
        Meetings > 0 ||
        JournalComments > 0 ||
        JournalEvaluationLinks > 0;
}
