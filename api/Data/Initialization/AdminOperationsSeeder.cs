using InternManager.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data.Initialization;

public static class AdminOperationsSeeder
{
    private static readonly (string Name, string Trigger, bool Enabled)[] DefaultNotificationRules =
    [
        ("Deliverable Submission", "deliverable.submitted", true),
        ("Deliverable Validation", "deliverable.validated", true),
        ("Evaluation Submission", "evaluation.submitted", true),
        ("Intern Onboarding Pending", "intern.onboarding.pending", true)
    ];

    private static readonly (string Name, string Subject, string Body)[] DefaultEmailTemplates =
    [
        (
            "welcome_intern",
            "Welcome {{firstName}}",
            "Hello {{firstName}},\n\nWelcome to Axia Intern Manager.\n\nRegards,\nAxia Team"
        ),
        (
            "evaluation_reminder",
            "Evaluation Reminder - {{internName}}",
            "Hello {{supervisorName}},\n\nPlease complete the pending evaluation for {{internName}}.\n\nRegards,\nAxia Team"
        )
    ];

    private static readonly string[] MatrixRoles = ["SuperAdmin", "Admin", "Manager", "Supervisor", "Intern"];
    private static readonly string[] MatrixDashboards = ["Executive", "Operations", "Evaluation", "Recruitment"];

    public static async Task SeedDefaultsAsync(AppDbContext dbContext, ILogger logger, CancellationToken cancellationToken = default)
    {
        var existingRuleTriggers = await dbContext.AdminNotificationRules
            .AsNoTracking()
            .Select(rule => rule.Trigger)
            .ToListAsync(cancellationToken);

        var rulesToInsert = DefaultNotificationRules
            .Where(defaultRule => !existingRuleTriggers.Contains(defaultRule.Trigger, StringComparer.OrdinalIgnoreCase))
            .Select(defaultRule => new AdminNotificationRule
            {
                Id = Guid.NewGuid(),
                Name = defaultRule.Name,
                Trigger = defaultRule.Trigger,
                Enabled = defaultRule.Enabled
            })
            .ToList();

        if (rulesToInsert.Count > 0)
        {
            await dbContext.AdminNotificationRules.AddRangeAsync(rulesToInsert, cancellationToken);
        }

        var existingTemplateNames = await dbContext.AdminEmailTemplates
            .AsNoTracking()
            .Select(template => template.Name)
            .ToListAsync(cancellationToken);

        var templatesToInsert = DefaultEmailTemplates
            .Where(defaultTemplate => !existingTemplateNames.Contains(defaultTemplate.Name, StringComparer.OrdinalIgnoreCase))
            .Select(defaultTemplate => new AdminEmailTemplate
            {
                Id = Guid.NewGuid(),
                Name = defaultTemplate.Name,
                Subject = defaultTemplate.Subject,
                Body = defaultTemplate.Body
            })
            .ToList();

        if (templatesToInsert.Count > 0)
        {
            await dbContext.AdminEmailTemplates.AddRangeAsync(templatesToInsert, cancellationToken);
        }

        var existingMatrixKeys = await dbContext.AdminBiAccessPermissions
            .AsNoTracking()
            .Select(permission => BuildMatrixKey(permission.Role, permission.Dashboard))
            .ToListAsync(cancellationToken);

        var matrixEntriesToInsert = (
            from role in MatrixRoles
            from dashboard in MatrixDashboards
            let key = BuildMatrixKey(role, dashboard)
            where !existingMatrixKeys.Contains(key, StringComparer.OrdinalIgnoreCase)
            select new AdminBiAccessPermission
            {
                Role = role,
                Dashboard = dashboard,
                Allowed = false
            })
            .ToList();

        if (matrixEntriesToInsert.Count > 0)
        {
            await dbContext.AdminBiAccessPermissions.AddRangeAsync(matrixEntriesToInsert, cancellationToken);
        }

        if (rulesToInsert.Count == 0 && templatesToInsert.Count == 0 && matrixEntriesToInsert.Count == 0)
        {
            return;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Seeded admin operation defaults: {Rules} notification rules, {Templates} email templates, {MatrixEntries} BI matrix entries.",
            rulesToInsert.Count,
            templatesToInsert.Count,
            matrixEntriesToInsert.Count);
    }

    private static string BuildMatrixKey(string role, string dashboard)
    {
        return $"{role}|{dashboard}";
    }
}
