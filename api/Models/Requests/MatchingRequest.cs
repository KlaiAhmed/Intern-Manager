namespace InternManager.Api.Models.Requests;

public class MatchingRequest
{
    public Guid InternId { get; set; }

    public List<string> Skills { get; set; } = [];

    public string? Level { get; set; }

    public string? Interests { get; set; }
}
