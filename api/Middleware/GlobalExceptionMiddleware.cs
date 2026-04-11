using InternManager.Api.Common.Utilities;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace InternManager.Api.Middleware;

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            await HandleExceptionAsync(context, exception);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (context.Response.HasStarted)
        {
            throw exception;
        }

        var (statusCode, title, detail) = MapException(exception);

        if (statusCode >= 500)
        {
            logger.LogError(exception, "Unhandled exception during API request.");
        }
        else
        {
            logger.LogWarning(exception, "Handled exception during API request.");
        }

        var problemDetails = new ProblemDetails
        {
            Type = ProblemDetailsHelper.GetProblemTypeUri(statusCode),
            Title = title,
            Detail = detail,
            Status = statusCode,
            Instance = context.Request.Path
        };

        problemDetails.Extensions["traceId"] = context.TraceIdentifier;

        if (exception is ValidationException validationException)
        {
            var errors = validationException.Errors
                .GroupBy(item => item.PropertyName)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(item => item.ErrorMessage).Distinct().ToArray());

            problemDetails.Extensions["errors"] = errors;
        }

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";

        await context.Response.WriteAsJsonAsync(problemDetails);
    }

    private static (int StatusCode, string Title, string Detail) MapException(Exception exception)
    {
        return exception switch
        {
            ValidationException validationException => (
                StatusCodes.Status400BadRequest,
                "Validation failed.",
                validationException.Message),
            ArgumentException argumentException => (
                StatusCodes.Status400BadRequest,
                "Invalid request.",
                argumentException.Message),
            KeyNotFoundException keyNotFoundException => (
                StatusCodes.Status404NotFound,
                "Resource not found.",
                keyNotFoundException.Message),
            UnauthorizedAccessException unauthorizedAccessException => (
                StatusCodes.Status403Forbidden,
                "Forbidden.",
                unauthorizedAccessException.Message),
            InvalidOperationException invalidOperationException => (
                StatusCodes.Status409Conflict,
                "Operation conflict.",
                invalidOperationException.Message),
            _ => (
                StatusCodes.Status500InternalServerError,
                "Internal Server Error.",
                "An unexpected error occurred while processing the request.")
        };
    }
}
