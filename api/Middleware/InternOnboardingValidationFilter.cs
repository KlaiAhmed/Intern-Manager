using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace InternManager.Api.Middleware;

public sealed class InternOnboardingValidationFilter(AppDbContext dbContext) : IAsyncActionFilter
{
    public const string ValidatedPayloadItemKey = "intern.onboarding.validated-payload";
    private const long MaxCvUploadBytes = 2 * 1024 * 1024;
    private static readonly Regex PhoneNumberRegex = new(@"^\+?[0-9][0-9\s().-]{6,19}$", RegexOptions.Compiled);

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var internId = UserContextHelper.ResolveCurrentUserId(context.HttpContext.User);
        if (!internId.HasValue)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var intern = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, context.HttpContext.RequestAborted);

        if (intern is null)
        {
            context.Result = new NotFoundObjectResult(new { message = "Intern not found." });
            return;
        }

        if (intern.VerificationStatus != InternVerificationStatus.INCOMPLETE)
        {
            context.Result = new ConflictObjectResult(new
            {
                message = "Onboarding has already been submitted and cannot be resubmitted."
            });

            return;
        }

        var form = context.ActionArguments.Values
            .OfType<InternOnboardingForm>()
            .FirstOrDefault();

        if (form is null)
        {
            context.Result = new BadRequestObjectResult(new
            {
                message = "Invalid onboarding payload.",
                errors = new Dictionary<string, string[]>
                {
                    ["payload"] = ["Multipart onboarding payload is required."]
                }
            });
            return;
        }

        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        static void AddFieldError(IDictionary<string, string[]> target, string field, string message)
        {
            if (target.TryGetValue(field, out var existing))
            {
                target[field] = [.. existing, message];
                return;
            }

            target[field] = [message];
        }

        var rawUniversityId = form.UniversityId?.Trim();
        var major = (form.Major ?? string.Empty).Trim();
        var currentYearOfStudy = (form.CurrentYearOfStudy ?? string.Empty).Trim();
        var phoneNumber = NormalizePhoneNumber(form.PhoneNumber);
        Guid universityId = Guid.Empty;

        if (string.IsNullOrWhiteSpace(rawUniversityId) || !Guid.TryParse(rawUniversityId, out universityId))
        {
            AddFieldError(errors, "universityId", "Selected university is not valid.");
        }
        else
        {
            var universityExists = await dbContext.Schools
                .AsNoTracking()
                .AnyAsync(school => school.Id == universityId, context.HttpContext.RequestAborted);

            if (!universityExists)
            {
                AddFieldError(errors, "universityId", "Selected university is not valid.");
            }
        }

        if (string.IsNullOrWhiteSpace(major))
        {
            AddFieldError(errors, "major", "Major is required.");
        }

        if (string.IsNullOrWhiteSpace(currentYearOfStudy))
        {
            AddFieldError(errors, "currentYearOfStudy", "Current year of study is required.");
        }

        if (!TryParseWorkPreference(form.WorkPreference, out var workPreference))
        {
            AddFieldError(errors, "workPreference", "Work preference must be one of: remote, hybrid, onsite.");
        }

        if (!string.IsNullOrWhiteSpace(phoneNumber) && !IsValidPhoneNumber(phoneNumber))
        {
            AddFieldError(errors, "phoneNumber", "Phone number format is invalid.");
        }

        if (errors.Count > 0)
        {
            context.Result = new BadRequestObjectResult(new
            {
                message = "Validation failed.",
                errors
            });

            return;
        }

        if (form.Cv is null || form.Cv.Length == 0 ||
            form.Cv.Length > MaxCvUploadBytes ||
            !string.Equals(form.Cv.ContentType?.Trim(), "application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            context.Result = new BadRequestObjectResult(new
            {
                message = "CV must be a PDF file under 2MB.",
                errors = new Dictionary<string, string[]>
                {
                    ["cv"] = ["CV must be a PDF file under 2MB."]
                }
            });

            return;
        }

        if (!HasValidPdfSignature(form.Cv))
        {
            context.Result = new BadRequestObjectResult(new
            {
                message = "CV must be a valid PDF file.",
                errors = new Dictionary<string, string[]>
                {
                    ["cv"] = ["CV must be a valid PDF file."]
                }
            });

            return;
        }

        context.HttpContext.Items[ValidatedPayloadItemKey] = new ValidatedInternOnboardingPayload(
            universityId,
            major,
            currentYearOfStudy,
            workPreference,
            phoneNumber,
            form.Cv!);

        await next();
    }

    private static bool TryParseWorkPreference(string? raw, out WorkPreference preference)
    {
        preference = default;

        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var normalized = raw.Trim().ToLowerInvariant();
        preference = normalized switch
        {
            "remote" => WorkPreference.Remote,
            "hybrid" => WorkPreference.Hybrid,
            "onsite" => WorkPreference.Onsite,
            _ => default
        };

        return normalized is "remote" or "hybrid" or "onsite";
    }

    private static string? NormalizePhoneNumber(string? raw)
    {
        return string.IsNullOrWhiteSpace(raw)
            ? null
            : raw.Trim();
    }

    private static bool IsValidPhoneNumber(string value)
    {
        return PhoneNumberRegex.IsMatch(value);
    }

    private static bool HasValidPdfSignature(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        var header = new byte[5];
        var bytesRead = stream.Read(header, 0, header.Length);

        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        return bytesRead == 5 &&
               header[0] == 0x25 && // %
               header[1] == 0x50 && // P
               header[2] == 0x44 && // D
               header[3] == 0x46 && // F
               header[4] == 0x2D;   // -
    }
}
