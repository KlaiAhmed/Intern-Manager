namespace InternManager.Api.Models.Requests;

public sealed class RejectDeliverableRequest
{
    public string Reason { get; set; } = string.Empty;

    public List<Guid> TaskIdsToReopen { get; set; } = [];

    public int RowVersion { get; set; }
}
