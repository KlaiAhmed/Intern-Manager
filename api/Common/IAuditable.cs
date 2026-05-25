namespace InternManager.Api.Common;

// FIX M17: single auditable interface for timestamp logic.
public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
}
