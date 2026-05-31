using InternManager.Api.Common.Constants;

namespace InternManager.Api.Common.Utilities;

public static class DisplayProgressHelper
{
    /// <summary>
    /// Returns the display progress for an intern-facing API response.
    /// The raw progress is an internal/admin value; this value must never be persisted.
    /// </summary>
    public static int ComputeDisplayProgress(decimal rawProgress, string deliverableStatus)
    {
        var normalizedStatus = deliverableStatus.Trim().ToLowerInvariant();

        return normalizedStatus switch
        {
            DomainStatuses.Deliverable.Approved or DomainStatuses.Deliverable.Accepted => 100,
            DomainStatuses.Deliverable.AwaitingReview or DomainStatuses.Deliverable.Submitted => (int)Math.Min(rawProgress, 80m),
            DomainStatuses.Deliverable.Draft or DomainStatuses.Deliverable.Pending => 0,
            _ => (int)rawProgress
        };
    }
}
