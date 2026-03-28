using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace InternManager.Api.Middleware;

public sealed class CsrfValidationFilter : IAsyncActionFilter
{
    private static readonly HashSet<string> StateChangingMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post,
        HttpMethods.Put,
        HttpMethods.Patch,
        HttpMethods.Delete
    };

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;

        if (!StateChangingMethods.Contains(request.Method))
        {
            await next();
            return;
        }

        var allowsAnonymous =
            context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<IAllowAnonymous>() is not null ||
            context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any();

        if (allowsAnonymous)
        {
            await next();
            return;
        }

        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        if (!request.Headers.TryGetValue("X-CSRF-Token", out var csrfHeaderValues))
        {
            context.Result = new ForbidResult();
            return;
        }

        var csrfHeaderToken = csrfHeaderValues.ToString();
        var csrfClaimToken = user.FindFirstValue("csrf");

        if (string.IsNullOrWhiteSpace(csrfHeaderToken) ||
            string.IsNullOrWhiteSpace(csrfClaimToken) ||
            !FixedTimeEquals(csrfHeaderToken, csrfClaimToken))
        {
            context.Result = new ForbidResult();
            return;
        }

        await next();
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);

        if (leftBytes.Length != rightBytes.Length)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}
