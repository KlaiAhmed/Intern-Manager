using System.Security.Claims;
using InternManager.Api.Common.Attributes;
using InternManager.Api.Common.Enums;
using InternManager.Api.Middleware;
using InternManager.Api.Models.FeatureFlags;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;

namespace InternManager.Api.Tests;

public sealed class FeatureFlagGateFilterTests
{
    [Fact]
    public async Task BlocksRequestWhenCardIsHidden()
    {
        var internId = Guid.NewGuid();
        var config = BuildConfig(tasksVisible: false, tasksInteractive: true);
        var filter = new FeatureFlagGateFilter(new FakeMissionFeatureFlagsService(config));
        var context = BuildExecutingContext(internId, "POST", DashboardCard.Tasks);

        var nextCalled = false;

        await filter.OnActionExecutionAsync(context, () =>
        {
            nextCalled = true;
            return Task.FromResult(new ActionExecutedContext(context, new List<IFilterMetadata>(), new object()));
        });

        var objectResult = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
        Assert.Equal("FEATURE_DISABLED", ReadAnonymousProperty(objectResult.Value, "code"));
        Assert.False(nextCalled);
    }

    [Fact]
    public async Task AllowsReadOnlyGetRequest()
    {
        var internId = Guid.NewGuid();
        var config = BuildConfig(tasksVisible: true, tasksInteractive: false);
        var filter = new FeatureFlagGateFilter(new FakeMissionFeatureFlagsService(config));
        var context = BuildExecutingContext(internId, "GET", DashboardCard.Tasks);

        var nextCalled = false;

        await filter.OnActionExecutionAsync(context, () =>
        {
            nextCalled = true;
            return Task.FromResult(new ActionExecutedContext(context, new List<IFilterMetadata>(), new object()));
        });

        Assert.True(nextCalled);
        Assert.Null(context.Result);
    }

    private static ActionExecutingContext BuildExecutingContext(Guid internId, string httpMethod, DashboardCard card)
    {
        var claims = new[]
        {
            new Claim("userId", internId.ToString()),
            new Claim(ClaimTypes.Role, "Intern"),
        };

        var identity = new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role);
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext
        {
            User = principal,
        };
        httpContext.Request.Method = httpMethod;

        var actionDescriptor = new ActionDescriptor
        {
            EndpointMetadata = new List<object>
            {
                new FeatureCardAttribute(card),
            }
        };

        var actionContext = new ActionContext(httpContext, new RouteData(), actionDescriptor);

        return new ActionExecutingContext(
            actionContext,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            new object());
    }

    private static MissionCardConfig BuildConfig(bool tasksVisible, bool tasksInteractive)
    {
        var defaultCard = new CardConfig(true, true, null);

        return new MissionCardConfig(
            MissionOverview: defaultCard,
            QuickStats: defaultCard,
            Tasks: new CardConfig(tasksVisible, tasksInteractive, null),
            Deliverables: defaultCard,
            Evaluation: defaultCard,
            Journal: defaultCard,
            Meeting: defaultCard);
    }

    private static string ReadAnonymousProperty(object? target, string propertyName)
    {
        var property = target?.GetType().GetProperty(propertyName);
        var value = property?.GetValue(target);
        return value?.ToString() ?? string.Empty;
    }

    private sealed class FakeMissionFeatureFlagsService(MissionCardConfig config) : IMissionFeatureFlagsService
    {
        public Task<MissionCardConfig> GetMissionConfigAsync(Guid missionId, CancellationToken cancellationToken)
        {
            return Task.FromResult(config);
        }

        public Task<MissionCardConfig> UpdateMissionConfigAsync(
            Guid missionId,
            MissionCardConfig updatedConfig,
            Guid actorUserId,
            string actorDisplayName,
            CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<IReadOnlyList<MissionFeatureFlagHistoryItemResponse>> GetHistoryAsync(
            Guid missionId,
            int take,
            CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<MissionCardConfig?> GetActiveMissionConfigForInternAsync(Guid internId, CancellationToken cancellationToken)
        {
            return Task.FromResult<MissionCardConfig?>(config);
        }

        public CardConfig ResolveCardConfig(MissionCardConfig missionCardConfig, DashboardCard dashboardCard)
        {
            return dashboardCard switch
            {
                DashboardCard.MissionOverview => missionCardConfig.MissionOverview,
                DashboardCard.QuickStats => missionCardConfig.QuickStats,
                DashboardCard.Tasks => missionCardConfig.Tasks,
                DashboardCard.Deliverables => missionCardConfig.Deliverables,
                DashboardCard.Evaluation => missionCardConfig.Evaluation,
                DashboardCard.Journal => missionCardConfig.Journal,
                DashboardCard.Meeting => missionCardConfig.Meeting,
                _ => missionCardConfig.MissionOverview,
            };
        }

        public void InvalidateMissionCache(Guid missionId)
        {
        }
    }
}
