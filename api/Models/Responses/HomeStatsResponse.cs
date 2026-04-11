namespace InternManager.Api.Models.Responses;

public sealed class HomeStatsResponse
{
    public int Supervisors { get; init; }

    public int Interns { get; init; }

    public int Missions { get; init; }
}