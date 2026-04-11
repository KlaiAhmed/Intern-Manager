namespace InternManager.Api.Models.Responses;

/// <summary>
/// Notification intern retournée par l API.
/// </summary>
public sealed class InternNotificationResponse
{
    public int NotificationId { get; init; }

    public string Type { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;

    public int? RelatedEntityId { get; init; }

    public bool IsRead { get; init; }

    public DateTime CreatedAt { get; init; }
}

/// <summary>
/// Réponse paginée du flux de notifications intern.
/// </summary>
public sealed class InternNotificationPageResponse
{
    public IReadOnlyList<InternNotificationResponse> Data { get; init; } = [];

    public int Total { get; init; }

    public int Page { get; init; }

    public int PageSize { get; init; }
}
