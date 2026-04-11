using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace InternManager.Api.Middleware;

/// <summary>
/// Filtre MVC qui applique une vérification Double Submit Token entre l en-tête `X-CSRF-Token` et le claim `csrf`.
/// </summary>
public sealed class CsrfValidationFilter : IAsyncActionFilter
{
    /// <summary>
    /// Liste des verbes HTTP considérés comme modifiant l état serveur.
    /// </summary>
    private static readonly HashSet<string> StateChangingMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post,
        HttpMethods.Put,
        HttpMethods.Patch,
        HttpMethods.Delete
    };

    /// <summary>
    /// Exécute la validation CSRF avant l action MVC pour les verbes sensibles.
    /// </summary>
    /// <param name="context">Contexte d exécution de l action en cours.</param>
    /// <param name="next">Délégué permettant de poursuivre la pipeline MVC.</param>
    /// <returns>Une tâche asynchrone représentant le flux de validation puis d exécution éventuelle.</returns>
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;

        if (DevelopmentLazyAuthBypassMiddleware.IsLazyBypassActive(context.HttpContext))
        {
            await next();
            return;
        }

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

    /// <summary>
    /// Compare deux chaînes en temps constant pour limiter les attaques par mesure de temps.
    /// </summary>
    /// <param name="left">Première valeur à comparer.</param>
    /// <param name="right">Seconde valeur à comparer.</param>
    /// <returns><see langword="true"/> si les deux valeurs sont strictement égales ; sinon <see langword="false"/>.</returns>
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
