using InternManager.Api.Common.Attributes;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace InternManager.Api.Middleware;

/// <summary>
/// Filtre d action qui applique le contrôle de visibilité/interactivité des cartes dashboard pour les endpoints intern.
/// </summary>
public sealed class FeatureFlagGateFilter(IMissionFeatureFlagsService missionFeatureFlagsService) : IAsyncActionFilter
{
    /// <inheritdoc />
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var featureCard = context.ActionDescriptor.EndpointMetadata
            .OfType<FeatureCardAttribute>()
            .FirstOrDefault();

        if (featureCard is null)
        {
            await next();
            return;
        }

        var principal = context.HttpContext.User;
        if (principal.Identity?.IsAuthenticated != true || !principal.IsInRole("Intern"))
        {
            await next();
            return;
        }

        var internId = UserContextHelper.ResolveCurrentUserId(principal);
        if (!internId.HasValue)
        {
            await next();
            return;
        }

        var missionConfig = await missionFeatureFlagsService.GetActiveMissionConfigForInternAsync(
            internId.Value,
            context.HttpContext.RequestAborted);

        if (missionConfig is null)
        {
            await next();
            return;
        }

        var cardConfig = missionFeatureFlagsService.ResolveCardConfig(missionConfig, featureCard.DashboardCard);
        var cardName = ToCardName(featureCard.DashboardCard);

        if (!cardConfig.IsVisible)
        {
            context.Result = new ObjectResult(new
            {
                code = "FEATURE_DISABLED",
                card = cardName
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };

            return;
        }

        var method = context.HttpContext.Request.Method;
        var isWriteOperation = !HttpMethods.IsGet(method) && !HttpMethods.IsHead(method) && !HttpMethods.IsOptions(method);

        if (isWriteOperation && !cardConfig.IsInteractive)
        {
            context.Result = new ObjectResult(new
            {
                code = "FEATURE_READONLY",
                card = cardName
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };

            return;
        }

        await next();
    }

    private static string ToCardName(DashboardCard dashboardCard)
    {
        return dashboardCard switch
        {
            DashboardCard.MissionOverview => "missionOverview",
            DashboardCard.QuickStats => "quickStats",
            DashboardCard.Tasks => "tasks",
            DashboardCard.Deliverables => "deliverables",
            DashboardCard.Evaluation => "evaluation",
            DashboardCard.Journal => "journal",
            DashboardCard.Meeting => "meeting",
            _ => "missionOverview"
        };
    }
}
