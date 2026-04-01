using InternManager.Api.Common.Enums;

namespace InternManager.Api.Common.Utilities;

/// <summary>
/// Validates canonical intern lifecycle transitions.
/// </summary>
public static class InternLifecycleStateMachine
{
    private static readonly IReadOnlyDictionary<InternLifecycleStatus, int> StateOrder = new Dictionary<InternLifecycleStatus, int>
    {
        [InternLifecycleStatus.INCOMPLETE] = 0,
        [InternLifecycleStatus.PENDING] = 1,
        [InternLifecycleStatus.ACTIVE] = 2,
        [InternLifecycleStatus.COMPLETED] = 3,
        [InternLifecycleStatus.ARCHIVED] = 4
    };

    public static bool IsForwardOneStep(InternLifecycleStatus current, InternLifecycleStatus next)
    {
        return StateOrder[next] == StateOrder[current] + 1;
    }

    public static bool IsSameState(InternLifecycleStatus current, InternLifecycleStatus next)
    {
        return current == next;
    }

    public static bool TryParse(string? rawValue, out InternLifecycleStatus status)
    {
        status = default;

        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return false;
        }

        var normalized = rawValue
            .Trim()
            .ToUpperInvariant()
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal);

        status = normalized switch
        {
            "INCOMPLETE" => InternLifecycleStatus.INCOMPLETE,
            "PENDING" => InternLifecycleStatus.PENDING,
            "ACTIVE" => InternLifecycleStatus.ACTIVE,
            "COMPLETED" => InternLifecycleStatus.COMPLETED,
            "ARCHIVED" => InternLifecycleStatus.ARCHIVED,
            _ => default
        };

        return normalized is "INCOMPLETE" or "PENDING" or "ACTIVE" or "COMPLETED" or "ARCHIVED";
    }
}
