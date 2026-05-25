using System.Reflection;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace InternManager.Api.Tests;

public sealed class AdminSettingsCleanupTests
{
    [Fact]
    public void VerificationStatusCrudEndpoints_AreRemoved()
    {
        var controllerType = typeof(AdminSettingsController);
        var methods = controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);

        var verificationStatusMethods = methods
            .Where(m => m.Name.Contains("VerificationStatus", StringComparison.OrdinalIgnoreCase))
            .ToList();

        Assert.Empty(verificationStatusMethods);
    }

    [Fact]
    public void DepartmentEndpoints_StillExist()
    {
        var controllerType = typeof(AdminSettingsController);
        var methods = controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        var endpointMethods = methods
            .Where(m => m.GetCustomAttributes<HttpGetAttribute>().Any(a =>
                a.Template?.Contains("departments", StringComparison.OrdinalIgnoreCase) == true))
            .ToList();

        Assert.Contains(endpointMethods, m => m.Name == nameof(AdminSettingsController.GetDepartments));
    }

    [Fact]
    public void InternVerificationStatusEnum_HasAllExpectedValues()
    {
        var names = Enum.GetNames<InternVerificationStatus>();

        Assert.Contains("INCOMPLETE", names);
        Assert.Contains("PENDING", names);
        Assert.Contains("ACTIVE", names);
        Assert.Contains("NOT_APPLICABLE", names);
    }

    [Fact]
    public void SchoolEndpoints_StillExist()
    {
        var controllerType = typeof(AdminSettingsController);
        var methods = controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        var endpointMethods = methods
            .Where(m => m.GetCustomAttributes<HttpGetAttribute>().Any(a =>
                a.Template?.Contains("schools", StringComparison.OrdinalIgnoreCase) == true))
            .ToList();

        Assert.Contains(endpointMethods, m => m.Name == nameof(AdminSettingsController.GetSchools));
    }

    [Fact]
    public void SkillEndpoints_StillExist()
    {
        var controllerType = typeof(AdminSettingsController);
        var methods = controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
        var endpointMethods = methods
            .Where(m => m.GetCustomAttributes<HttpGetAttribute>().Any(a =>
                a.Template?.Contains("skills", StringComparison.OrdinalIgnoreCase) == true))
            .ToList();

        Assert.Contains(endpointMethods, m => m.Name == nameof(AdminSettingsController.GetSkills));
    }
}
