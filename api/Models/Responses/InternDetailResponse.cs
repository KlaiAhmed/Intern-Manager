namespace InternManager.Api.Models.Responses;

public sealed class InternDetailResponse
{
    public Guid Id { get; init; }

    public string FirstName { get; init; } = string.Empty;

    public string LastName { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public string AccountStatus { get; init; } = string.Empty;

    public string VerificationStatus { get; init; } = string.Empty;

    public string? CvFileUrl { get; init; }

    public DateTime? StartDate { get; init; }

    public DateTime? EndDate { get; init; }

    public string? Phone { get; init; }

    public string? School { get; init; }

    public string? Specialty { get; init; }

    public string? Level { get; init; }

    public IReadOnlyList<InternDetailSkillResponse> Skills { get; init; } = Array.Empty<InternDetailSkillResponse>();

    public InternCurrentInternshipResponse? CurrentInternship { get; init; }
}

public sealed class InternDetailSkillResponse
{
    public Guid Id { get; init; }

    public string Name { get; init; } = string.Empty;
}

public sealed class InternCurrentInternshipResponse
{
    public Guid Id { get; init; }

    public string? Type { get; init; }

    public string? Department { get; init; }

    public DateTime? StartDate { get; init; }

    public DateTime? EndDate { get; init; }

    public string Status { get; init; } = string.Empty;

    public InternCurrentInternshipSupervisorResponse? Supervisor { get; init; }

    public InternCurrentInternshipMissionResponse Mission { get; init; } = new();
}

public sealed class InternCurrentInternshipSupervisorResponse
{
    public Guid Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;
}

public sealed class InternCurrentInternshipMissionResponse
{
    public Guid Id { get; init; }

    public string Title { get; init; } = string.Empty;
}
