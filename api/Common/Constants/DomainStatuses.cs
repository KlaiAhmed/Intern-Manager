namespace InternManager.Api.Common.Constants;

public static class DomainStatuses
{
    public static class Mission
    {
        public const string Template = "template";
        public const string Active = "active";
        public const string Paused = "paused";
        public const string Completed = "completed";
        public const string Cancelled = "cancelled";
        public const string Archived = "archived";
    }

    public static class Deliverable
    {
        public const string Draft = "draft";
        public const string InProgress = "in_progress";
        public const string AwaitingReview = "awaiting_review";
        public const string Approved = "approved";
        public const string ChangesRequested = "changes_requested";
        public const string Cancelled = "cancelled";

        // Compatibility aliases kept during the phase rollout.
        public const string Pending = "pending";
        public const string Submitted = "submitted";
        public const string Accepted = "accepted";
        public const string Rejected = "rejected";
    }

    public static class Task
    {
        public const string Todo = "todo";
        public const string InProgress = "in_progress";
        public const string Done = "done";
        public const string Reopened = "reopened";
        public const string Cancelled = "cancelled";
    }

    public static class Evaluation
    {
        public const string Draft = "draft";
        public const string Submitted = "submitted";
        public const string Released = "released";

        // Compatibility alias kept during the phase rollout.
        public const string Pending = "pending";
    }

    public static class DeliverableVersion
    {
        public const string Submitted = "submitted";
        public const string Approved = "approved";
        public const string Rejected = "rejected";
    }
}
