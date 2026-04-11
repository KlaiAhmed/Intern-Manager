namespace InternManager.Api.Models.Entities;

public sealed class JournalComment
{
    public int JournalCommentId { get; set; }

    public Guid JournalEntryId { get; set; }

    public Guid AuthorId { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public JournalEntry? JournalEntry { get; set; }

    public User? Author { get; set; }
}