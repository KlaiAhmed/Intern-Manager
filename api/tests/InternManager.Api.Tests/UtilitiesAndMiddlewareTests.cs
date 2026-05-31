using System.Net;
using System.Security.Claims;
using System.Text.Json;
using FluentValidation;
using FluentValidation.Results;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Exceptions;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Middleware;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Validation;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class UtilitiesAndMiddlewareTests
{
    [Theory]
    [InlineData("Aa1!aaaa", true)]
    [InlineData(" Aa1!aaaa ", true)]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("Aa1!", false)]
    [InlineData("aa1!aaaa", false)]
    [InlineData("AA1!AAAA", false)]
    [InlineData("Aaa!aaaa", false)]
    [InlineData("Aa11aaaa", false)]
    public void PasswordPolicyValidator_EnforcesAllPasswordRules(string? password, bool expected)
    {
        var result = PasswordPolicyValidator.IsValid(password);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void UserContextHelper_ResolvesIdsActorsRolesAndScopes()
    {
        var userId = Guid.NewGuid();
        var principal = TestUsers.Principal(userId, UserRole.Supervisor, " supervisor@example.com ");

        Assert.Equal(userId, UserContextHelper.ResolveCurrentUserId(principal));
        Assert.Equal("supervisor@example.com", UserContextHelper.ResolveCurrentActorName(principal));
        Assert.Equal(UserRole.Supervisor, UserContextHelper.ResolveCurrentUserRole(principal));
        Assert.True(UserContextHelper.IsCurrentSupervisorScope("me", userId));
        Assert.True(UserContextHelper.IsCurrentSupervisorScope(userId.ToString(), userId));
        Assert.False(UserContextHelper.IsCurrentSupervisorScope(Guid.NewGuid().ToString(), userId));
        Assert.True(UserContextHelper.IsCurrentInternScope(null, userId));
        Assert.False(UserContextHelper.IsCurrentInternScope("not-a-guid", userId));
    }

    [Fact]
    public void ProblemDetailsHelper_ReturnsStableSecuritySensitiveMessages()
    {
        Assert.Equal("https://tools.ietf.org/html/rfc9110#section-15.5.2", ProblemDetailsHelper.GetProblemTypeUri(401));
        Assert.Equal("Forbidden", ProblemDetailsHelper.GetErrorTitle(403));
        Assert.Equal("Too many requests. Please try again later.", ProblemDetailsHelper.GetErrorMessage(429));
        Assert.Equal("Internal Server Error", ProblemDetailsHelper.GetErrorTitle(418));
        Assert.Equal("An unexpected error occurred.", ProblemDetailsHelper.GetErrorMessage(500));
    }

    [Theory]
    [InlineData("superadmin", UserRole.SuperAdmin)]
    [InlineData("ADMIN", UserRole.Admin)]
    [InlineData("Supervisor", UserRole.Supervisor)]
    [InlineData("unknown-role", UserRole.SuperAdmin)]
    public void DevelopmentAuthUsers_ResolvesKnownRolesAndFallsBackSafely(string requestedRole, UserRole expectedRole)
    {
        var seed = DevelopmentAuthUsers.ResolveForRole(requestedRole);

        Assert.Equal(expectedRole, seed.Role);
        Assert.StartsWith("dev.", seed.Email, StringComparison.Ordinal);
    }

    [Fact]
    public async Task CsrfValidationFilter_AllowsSafeMethodsWithoutToken()
    {
        var context = BuildActionExecutingContext("GET", TestUsers.Principal(Guid.NewGuid(), UserRole.Admin));
        var filter = new CsrfValidationFilter(NullLogger<CsrfValidationFilter>.Instance);
        var called = false;

        await filter.OnActionExecutionAsync(context, Next(context, () => called = true));

        Assert.True(called);
        Assert.Null(context.Result);
    }

    [Fact]
    public async Task CsrfValidationFilter_RejectsUnauthenticatedStateChangingRequests()
    {
        var context = BuildActionExecutingContext("POST", new ClaimsPrincipal(new ClaimsIdentity()));
        var filter = new CsrfValidationFilter(NullLogger<CsrfValidationFilter>.Instance);

        await filter.OnActionExecutionAsync(context, Next(context));

        Assert.IsType<UnauthorizedResult>(context.Result);
    }

    [Theory]
    [InlineData(null, "expected-token")]
    [InlineData("", "expected-token")]
    [InlineData("wrong-token", "expected-token")]
    [InlineData("short", "expected-token")]
    public async Task CsrfValidationFilter_RejectsMissingOrMismatchedTokens(string? headerToken, string claimToken)
    {
        var context = BuildActionExecutingContext(
            "DELETE",
            TestUsers.Principal(Guid.NewGuid(), UserRole.Admin, csrf: claimToken));

        if (headerToken is not null)
        {
            context.HttpContext.Request.Headers["X-CSRF-Token"] = headerToken;
        }

        var filter = new CsrfValidationFilter(NullLogger<CsrfValidationFilter>.Instance);

        await filter.OnActionExecutionAsync(context, Next(context));

        Assert.IsType<ForbidResult>(context.Result);
    }

    [Fact]
    public async Task CsrfValidationFilter_AllowsMatchingTokenAndAnonymousEndpoints()
    {
        var tokenContext = BuildActionExecutingContext(
            "POST",
            TestUsers.Principal(Guid.NewGuid(), UserRole.Admin, csrf: "expected-token"));
        tokenContext.HttpContext.Request.Headers["X-CSRF-Token"] = "expected-token";
        var filter = new CsrfValidationFilter(NullLogger<CsrfValidationFilter>.Instance);
        var tokenNextCalled = false;

        await filter.OnActionExecutionAsync(tokenContext, Next(tokenContext, () => tokenNextCalled = true));

        Assert.True(tokenNextCalled);
        Assert.Null(tokenContext.Result);

        var anonymousContext = BuildActionExecutingContext("POST", new ClaimsPrincipal(new ClaimsIdentity()));
        anonymousContext.ActionDescriptor.EndpointMetadata.Add(new AllowAnonymousAttribute());
        var anonymousNextCalled = false;

        await filter.OnActionExecutionAsync(anonymousContext, Next(anonymousContext, () => anonymousNextCalled = true));

        Assert.True(anonymousNextCalled);
        Assert.Null(anonymousContext.Result);
    }

    [Fact]
    public async Task DevelopmentLazyAuthBypassMiddleware_InjectsRoleFromEndpointAndCsrfHeader()
    {
        var previousAspNetCore = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var previousDotnet = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", null);

        try
        {
            var context = new DefaultHttpContext();
            context.Request.Path = "/api/supervisor/stats";
            context.SetEndpoint(new Endpoint(
                _ => Task.CompletedTask,
                new EndpointMetadataCollection(
                    new AuthorizeAttribute { Roles = "Admin,Supervisor" },
                    new AuthorizeAttribute { Roles = "Supervisor,Intern" }),
                "test"));

            var middleware = new DevelopmentLazyAuthBypassMiddleware(_ => Task.CompletedTask);

            await middleware.InvokeAsync(context);

            Assert.True(DevelopmentLazyAuthBypassMiddleware.IsLazyBypassActive(context));
            Assert.True(context.User.Identity?.IsAuthenticated);
            Assert.Equal("Supervisor", context.User.FindFirstValue("role"));
            Assert.Equal("dev.supervisor@axia.local", context.User.FindFirstValue("email"));
            Assert.Equal("dev-lazy-csrf-token", context.User.FindFirstValue("csrf"));
            Assert.Equal("dev-lazy-csrf-token", context.Request.Headers["X-CSRF-Token"].ToString());
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previousAspNetCore);
            Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", previousDotnet);
        }
    }

    [Fact]
    public async Task DevelopmentLazyAuthBypassMiddleware_SkipsNonApiAndMeRoutes()
    {
        var previous = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");

        try
        {
            var nonApi = new DefaultHttpContext();
            nonApi.Request.Path = "/health";
            var meRoute = new DefaultHttpContext();
            meRoute.Request.Path = "/api/auth/me";
            var middleware = new DevelopmentLazyAuthBypassMiddleware(_ => Task.CompletedTask);

            await middleware.InvokeAsync(nonApi);
            await middleware.InvokeAsync(meRoute);

            Assert.False(DevelopmentLazyAuthBypassMiddleware.IsLazyBypassActive(nonApi));
            Assert.False(DevelopmentLazyAuthBypassMiddleware.IsLazyBypassActive(meRoute));
            Assert.False(nonApi.User.Identity?.IsAuthenticated ?? false);
            Assert.False(meRoute.User.Identity?.IsAuthenticated ?? false);
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previous);
        }
    }

    [Fact]
    public async Task DevelopmentLazyAuthBypassMiddleware_ThrowsOutsideDevelopmentOrTesting()
    {
        var previousAspNetCore = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var previousDotnet = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");
        Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", null);

        try
        {
            var context = new DefaultHttpContext();
            context.Request.Path = "/api/users";
            var middleware = new DevelopmentLazyAuthBypassMiddleware(_ => Task.CompletedTask);

            await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context));
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previousAspNetCore);
            Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", previousDotnet);
        }
    }

    [Theory]
    [InlineData(typeof(ArgumentException), StatusCodes.Status400BadRequest, "Invalid request.")]
    [InlineData(typeof(KeyNotFoundException), StatusCodes.Status404NotFound, "Resource not found.")]
    [InlineData(typeof(NotFoundException), StatusCodes.Status404NotFound, "Resource not found.")]
    [InlineData(typeof(UnauthorizedAccessException), StatusCodes.Status403Forbidden, "Forbidden.")]
    [InlineData(typeof(ForbiddenException), StatusCodes.Status403Forbidden, "Forbidden.")]
    [InlineData(typeof(InvalidOperationException), StatusCodes.Status409Conflict, "Operation conflict.")]
    [InlineData(typeof(Exception), StatusCodes.Status500InternalServerError, "Internal Server Error.")]
    public async Task GlobalExceptionMiddleware_MapsKnownExceptionsToProblemDetails(
        Type exceptionType,
        int expectedStatus,
        string expectedTitle)
    {
        var exception = (Exception)Activator.CreateInstance(exceptionType, "boom")!;
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/test";
        context.Response.Body = new MemoryStream();
        var middleware = new GlobalExceptionMiddleware(_ => throw exception, NullLogger<GlobalExceptionMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body);

        Assert.Equal(expectedStatus, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);
        Assert.Equal(expectedTitle, json.RootElement.GetProperty("title").GetString());
        Assert.Equal("/api/test", json.RootElement.GetProperty("instance").GetString());
        Assert.True(json.RootElement.TryGetProperty("traceId", out _));

        if (expectedStatus == StatusCodes.Status500InternalServerError)
        {
            Assert.Equal("An unexpected error occurred while processing the request.", json.RootElement.GetProperty("detail").GetString());
        }
    }

    [Fact]
    public async Task GlobalExceptionMiddleware_IncludesValidationErrors()
    {
        var failures = new[]
        {
            new ValidationFailure("email", "email is required."),
            new ValidationFailure("email", "email is required."),
            new ValidationFailure("password", "password is weak.")
        };
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new GlobalExceptionMiddleware(
            _ => throw new ValidationException("Validation failed.", failures),
            NullLogger<GlobalExceptionMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body);

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        var errors = json.RootElement.GetProperty("errors");
        Assert.Single(errors.GetProperty("email").EnumerateArray());
        Assert.Equal("password is weak.", errors.GetProperty("password")[0].GetString());
    }

    [Fact]
    public void Validators_RejectInvalidPayloadsAndAllowValidPayloads()
    {
        var commentValidator = new SupervisorJournalCommentRequestValidator();
        Assert.False(commentValidator.Validate(new SupervisorJournalCommentRequest { Content = "" }).IsValid);
        Assert.False(commentValidator.Validate(new SupervisorJournalCommentRequest { Content = new string('x', 2001) }).IsValid);
        Assert.True(commentValidator.Validate(new SupervisorJournalCommentRequest { Content = "Looks good." }).IsValid);

        var linksValidator = new SupervisorJournalEvaluationLinksRequestValidator();
        Assert.False(linksValidator.Validate(new SupervisorJournalEvaluationLinksRequest { Criteria = null! }).IsValid);
        Assert.False(linksValidator.Validate(new SupervisorJournalEvaluationLinksRequest
        {
            Criteria =
            [
                JournalEvaluationCriteria.Technical,
                JournalEvaluationCriteria.Autonomy,
                JournalEvaluationCriteria.Communication,
                JournalEvaluationCriteria.DeadlineRespect,
                JournalEvaluationCriteria.DeliverableQuality,
                JournalEvaluationCriteria.Technical
            ]
        }).IsValid);
        Assert.False(linksValidator.Validate(new SupervisorJournalEvaluationLinksRequest
        {
            Criteria = [JournalEvaluationCriteria.Technical, JournalEvaluationCriteria.Technical]
        }).IsValid);
        Assert.True(linksValidator.Validate(new SupervisorJournalEvaluationLinksRequest
        {
            Criteria = [JournalEvaluationCriteria.Technical, JournalEvaluationCriteria.Autonomy]
        }).IsValid);

        var cardValidator = new MissionCardConfigValidator();
        var valid = MissionCardConfigDefaults.Create() with
        {
            Tasks = new CardConfig(true, true, JsonDocument.Parse("""{"minProgress":50}"""))
        };
        var invalid = MissionCardConfigDefaults.Create() with
        {
            Tasks = new CardConfig(true, true, JsonDocument.Parse("""[1,2,3]"""))
        };

        Assert.True(cardValidator.Validate(valid).IsValid);
        Assert.False(cardValidator.Validate(invalid).IsValid);
    }

    [Fact]
    public void MissionCardConfigJson_UsesDefaultsAndDeepClonesJsonDocuments()
    {
        var defaults = MissionCardConfigJson.Deserialize(null);
        Assert.True(defaults.Tasks.IsVisible);

        using var requirement = JsonDocument.Parse("""{"required":["a"]}""");
        var config = MissionCardConfigDefaults.Create() with
        {
            Tasks = new CardConfig(false, true, requirement)
        };

        var serialized = MissionCardConfigJson.Serialize(config);
        var deserialized = MissionCardConfigJson.Deserialize(serialized);
        var cloned = MissionCardConfigJson.Clone(config);

        Assert.False(deserialized.Tasks.IsVisible);
        Assert.Equal("""{"required":["a"]}""", cloned.Tasks.RequirementConfig?.RootElement.GetRawText());
        Assert.NotSame(requirement, cloned.Tasks.RequirementConfig);
    }

    private static ActionExecutingContext BuildActionExecutingContext(string method, ClaimsPrincipal user)
    {
        var httpContext = new DefaultHttpContext
        {
            User = user
        };
        httpContext.Request.Method = method;

        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor
        {
            EndpointMetadata = []
        });

        return new ActionExecutingContext(
            actionContext,
            [],
            new Dictionary<string, object?>(),
            new object());
    }

    private static ActionExecutionDelegate Next(ActionExecutingContext context, Action? onCalled = null)
    {
        return () =>
        {
            onCalled?.Invoke();
            return Task.FromResult(new ActionExecutedContext(context, [], new object()));
        };
    }
}
