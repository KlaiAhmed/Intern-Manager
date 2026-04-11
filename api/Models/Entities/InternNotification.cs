using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Entities;

public sealed class InternNotification
{
    public int NotificationId { get; set; }

    public Guid InternId { get; set; }

    public InternNotificationType Type { get; set; }

    public string Message { get; set; } = string.Empty;

    public int? RelatedEntityId { get; set; }

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? Intern { get; set; }
}