namespace InternManager.Api.Models.Entities;

public sealed class Meeting
{
    public Guid Id { get; set; }

    public Guid SupervisorId { get; set; }

    public Guid InternId { get; set; }

    public DateTime Date { get; set; }

    public string Notes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public User? Supervisor { get; set; }

    public User? Intern { get; set; }
}
