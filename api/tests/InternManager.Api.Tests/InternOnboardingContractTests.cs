using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Middleware;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class InternOnboardingContractTests
{
    [Fact]
    public async Task ValidationFilter_AllowsOnboardingWithoutRemovedDates()
    {
        var dbContext = CreateDbContext();
        var schoolId = Guid.NewGuid();
        var internId = Guid.NewGuid();

        dbContext.Users.Add(new User
        {
            Id = internId,
            FirstName = "Intern",
            LastName = "User",
            Email = "intern@example.com",
            PasswordHash = "hash",
            Role = UserRole.Intern,
            Status = UserStatus.Active,
            VerificationStatus = InternVerificationStatus.INCOMPLETE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        dbContext.Schools.Add(new School
        {
            Id = schoolId,
            Name = "Axia University",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();

        var filter = new InternOnboardingValidationFilter(dbContext);
        var form = CreateOnboardingForm(schoolId, includePhoneNumber: true);
        var httpContext = CreateHttpContext(internId);
        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        var executed = false;

        var context = new ActionExecutingContext(
            actionContext,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>
            {
                ["request"] = form
            },
            controller: new object());

        await filter.OnActionExecutionAsync(context, async () =>
        {
            executed = true;
            return new ActionExecutedContext(actionContext, new List<IFilterMetadata>(), new object());
        });

        Assert.True(executed);
        Assert.Null(context.Result);
        Assert.True(httpContext.Items.ContainsKey(InternOnboardingValidationFilter.ValidatedPayloadItemKey));
    }

    [Fact]
    public async Task Controller_SubmitOnboarding_WithValidatedPayload_SetsPendingStatus()
    {
        var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var universityId = Guid.NewGuid();

        dbContext.Users.Add(new User
        {
            Id = internId,
            FirstName = "Intern",
            LastName = "User",
            Email = "intern@example.com",
            PasswordHash = "hash",
            Role = UserRole.Intern,
            Status = UserStatus.Active,
            VerificationStatus = InternVerificationStatus.INCOMPLETE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();

        var controller = new InternOnboardingController(
            dbContext,
            new NoopNotificationService(),
            new NoopCvStorageService(),
            NullLogger<InternOnboardingController>.Instance);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = CreateHttpContext(internId)
        };

        controller.HttpContext.Items[InternOnboardingValidationFilter.ValidatedPayloadItemKey] = new ValidatedInternOnboardingPayload(
            universityId,
            "Computer Science",
            "licence_1",
            WorkPreference.Hybrid,
            "+21612345678",
            CreatePdfFile());

        var result = await controller.Submit(new InternOnboardingForm(), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var intern = await dbContext.Users.SingleAsync(user => user.Id == internId);
        var profile = await dbContext.InternProfiles.SingleAsync(item => item.InternId == internId);

        Assert.Equal(StatusCodes.Status200OK, ok.StatusCode);
        Assert.Equal(InternVerificationStatus.PENDING, intern.VerificationStatus);
        Assert.Equal(universityId, profile.UniversityId);
        Assert.Equal("Computer Science", profile.Major);
        Assert.Equal("licence_1", profile.CurrentYearOfStudy);
        Assert.Null(profile.ExpectedGraduationDate);
        Assert.Null(profile.StartDate);
        Assert.Null(profile.EndDate);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static DefaultHttpContext CreateHttpContext(Guid internId)
    {
        var context = new DefaultHttpContext();
        context.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(
            [
                new System.Security.Claims.Claim("userId", internId.ToString()),
                new System.Security.Claims.Claim("email", "intern@example.com")
            ],
            "TestAuth"));

        return context;
    }

    private static InternOnboardingForm CreateOnboardingForm(Guid schoolId, bool includePhoneNumber)
    {
        return new InternOnboardingForm
        {
            UniversityId = schoolId.ToString(),
            Major = "Computer Science",
            CurrentYearOfStudy = "licence_1",
            WorkPreference = "hybrid",
            PhoneNumber = includePhoneNumber ? "12345678" : null,
            Cv = CreatePdfFile()
        };
    }

    private static IFormFile CreatePdfFile()
    {
        var bytes = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37 };
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "cv", "cv.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };
    }

    private sealed class NoopNotificationService : INotificationService
    {
        public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
        {
            _ = userId;
            _ = type;
            _ = title;
            _ = message;
            _ = relatedEntity;
        }
    }

    private sealed class NoopCvStorageService : ICvStorageService
    {
        public Task<string> UploadAsync(IFormFile file, Guid internId, CancellationToken cancellationToken)
        {
            _ = file;
            _ = internId;
            _ = cancellationToken;
            return Task.FromResult("uploads/cv.pdf");
        }

        public Task DeleteAsync(string fileUrl, CancellationToken cancellationToken)
        {
            _ = fileUrl;
            _ = cancellationToken;
            return Task.CompletedTask;
        }
    }
}