namespace InternManager.Api.Common.Utilities;

/// <summary>
/// Helper utilities for standardized ProblemDetails responses.
/// </summary>
public static class ProblemDetailsHelper
{
    /// <summary>
    /// Returns the RFC 9110 problem type URI for a given HTTP status code.
    /// </summary>
    /// <param name="statusCode">The HTTP status code.</param>
    /// <returns>The RFC 9110 section URI for the status code.</returns>
    public static string GetProblemTypeUri(int statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => "https://tools.ietf.org/html/rfc9110#section-15.5.1",
        StatusCodes.Status401Unauthorized => "https://tools.ietf.org/html/rfc9110#section-15.5.2",
        StatusCodes.Status403Forbidden => "https://tools.ietf.org/html/rfc9110#section-15.5.4",
        StatusCodes.Status404NotFound => "https://tools.ietf.org/html/rfc9110#section-15.5.5",
        StatusCodes.Status405MethodNotAllowed => "https://tools.ietf.org/html/rfc9110#section-15.5.6",
        StatusCodes.Status409Conflict => "https://tools.ietf.org/html/rfc9110#section-15.5.10",
        StatusCodes.Status415UnsupportedMediaType => "https://tools.ietf.org/html/rfc9110#section-15.5.16",
        StatusCodes.Status429TooManyRequests => "https://tools.ietf.org/html/rfc9110#section-15.5.9",
        _ => "https://tools.ietf.org/html/rfc9110#section-15.6.1"
    };

    /// <summary>
    /// Returns a standard error title for a given HTTP status code.
    /// </summary>
    /// <param name="statusCode">The HTTP status code.</param>
    /// <returns>A human-readable error title.</returns>
    public static string GetErrorTitle(int statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => "Bad Request",
        StatusCodes.Status401Unauthorized => "Unauthorized",
        StatusCodes.Status403Forbidden => "Forbidden",
        StatusCodes.Status404NotFound => "Not Found",
        StatusCodes.Status405MethodNotAllowed => "Method Not Allowed",
        StatusCodes.Status409Conflict => "Conflict",
        StatusCodes.Status415UnsupportedMediaType => "Unsupported Media Type",
        StatusCodes.Status429TooManyRequests => "Too Many Requests",
        _ => "Internal Server Error"
    };

    /// <summary>
    /// Returns a detailed error message for a given HTTP status code.
    /// </summary>
    /// <param name="statusCode">The HTTP status code.</param>
    /// <returns>A user-friendly error message.</returns>
    public static string GetErrorMessage(int statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => "Bad request.",
        StatusCodes.Status401Unauthorized => "Authentication is required.",
        StatusCodes.Status403Forbidden => "You do not have permission to perform this action.",
        StatusCodes.Status404NotFound => "Resource not found.",
        StatusCodes.Status409Conflict => "The request could not be completed because of a conflict.",
        StatusCodes.Status429TooManyRequests => "Too many requests. Please try again later.",
        _ => "An unexpected error occurred."
    };
}
