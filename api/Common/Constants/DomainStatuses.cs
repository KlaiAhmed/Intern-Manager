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
    }

    public static class Deliverable
    {
        public const string Pending = "pending";
        public const string Submitted = "submitted";
        public const string Accepted = "accepted";
        public const string Rejected = "rejected";
    }

    public static class Evaluation
    {
        public const string Pending = "pending";
        public const string Submitted = "submitted";
    }
}
