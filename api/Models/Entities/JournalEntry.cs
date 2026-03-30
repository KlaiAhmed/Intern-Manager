/// <summary>
/// Represents a journal note written by an intern.
/// </summary>
namespace InternManager.Api.Models.Entities;

public sealed class JournalEntry
{
    public Guid Id { get; set; }

    public Guid InternId { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public User? Intern { get; set; }
}
