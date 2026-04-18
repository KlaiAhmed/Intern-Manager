using InternManager.Api.Common.Enums;

namespace InternManager.Api.Models.Requests;

public sealed class InternOnboardingForm
{
    public string? UniversityId { get; init; }

    public string? Major { get; init; }

    public string? CurrentYearOfStudy { get; init; }

    public string? ExpectedGraduationDate { get; init; }

    public string? StartDate { get; init; }

    public string? EndDate { get; init; }

    public string? WorkPreference { get; init; }

    public string? PhoneNumber { get; init; }

    public IFormFile? Cv { get; init; }
}

public sealed record ValidatedInternOnboardingPayload(
    Guid UniversityId,
    string Major,
    string CurrentYearOfStudy,
    DateTime ExpectedGraduationDate,
    DateTime StartDate,
    DateTime EndDate,
    WorkPreference WorkPreference,
    string? PhoneNumber,
    IFormFile Cv);
