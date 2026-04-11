using InternManager.Api.Common.Enums;

namespace InternManager.Api.Common.Attributes;

/// <summary>
/// Associe une action API à une carte du dashboard intern pour appliquer le contrôle de feature flags.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class FeatureCardAttribute(DashboardCard dashboardCard) : Attribute
{
    public DashboardCard DashboardCard { get; } = dashboardCard;
}
