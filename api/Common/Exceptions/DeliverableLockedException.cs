namespace InternManager.Api.Common.Exceptions;

public sealed class DeliverableLockedException : Exception
{
    public DeliverableLockedException(string message)
        : base(message)
    {
    }
}
