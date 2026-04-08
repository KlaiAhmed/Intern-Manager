using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data.Initialization;

public static class SqlMigrationScriptRunner
{
    public static async Task ApplyPendingScriptsAsync(AppDbContext dbContext, ILogger logger, string contentRootPath)
    {
        var migrationsDirectory = Path.Combine(contentRootPath, "Data", "Migrations");
        if (!Directory.Exists(migrationsDirectory))
        {
            logger.LogWarning("SQL migrations directory not found at {Path}.", migrationsDirectory);
            return;
        }

        const string ensureSqlHistoryTableSql = """
            IF OBJECT_ID(N'[dbo].[__SqlMigrationsHistory]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[__SqlMigrationsHistory] (
                    [ScriptName] NVARCHAR(500) NOT NULL CONSTRAINT [PK___SqlMigrationsHistory] PRIMARY KEY,
                    [AppliedAt] DATETIME2 NOT NULL
                );
            END
            """;

        await dbContext.Database.ExecuteSqlRawAsync(ensureSqlHistoryTableSql);

        var appliedScripts = await dbContext.Database
            .SqlQueryRaw<string>("SELECT [ScriptName] FROM [dbo].[__SqlMigrationsHistory]")
            .ToListAsync();

        var appliedScriptSet = appliedScripts
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var migrationFiles = Directory
            .GetFiles(migrationsDirectory, "*.sql", SearchOption.TopDirectoryOnly)
            .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        foreach (var migrationFile in migrationFiles)
        {
            var scriptName = Path.GetFileName(migrationFile);
            if (appliedScriptSet.Contains(scriptName))
            {
                logger.LogInformation("Skipping already applied SQL migration script {ScriptName}.", scriptName);
                continue;
            }

            var sql = await File.ReadAllTextAsync(migrationFile);
            if (string.IsNullOrWhiteSpace(sql))
            {
                continue;
            }

            foreach (var batch in SplitSqlBatches(sql))
            {
                await dbContext.Database.ExecuteSqlRawAsync(batch);
            }

            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO [dbo].[__SqlMigrationsHistory] ([ScriptName], [AppliedAt]) VALUES ({scriptName}, {DateTime.UtcNow})");

            appliedScriptSet.Add(scriptName);
            logger.LogInformation("Applied SQL migration script {ScriptName}.", scriptName);
        }

        await ValidateConstraintTrustAsync(dbContext, logger);
    }

    private static async Task ValidateConstraintTrustAsync(AppDbContext dbContext, ILogger logger)
    {
        var tablesToValidate = new[]
        {
            "Users",
            "AuditLogs",
            "InternTasks",
            "PasswordResetTokens",
            "InternProfiles",
            "InternProfileSkills",
            "Notifications",
            "MissionHistoryEntries",
            "DeliverableVersions"
        };

        foreach (var tableName in tablesToValidate)
        {
            try
            {
                await dbContext.Database.ExecuteSqlRawAsync(GetConstraintValidationSql(tableName));
            }
            catch (Exception exception)
            {
                var untrustedConstraints = await dbContext.Database
                    .SqlQueryRaw<ConstraintNameProjection>(
                        """
                        SELECT [fk].[name] AS [ConstraintName]
                        FROM [sys].[foreign_keys] AS [fk]
                        INNER JOIN [sys].[tables] AS [t]
                            ON [fk].[parent_object_id] = [t].[object_id]
                        WHERE [t].[name] = {0}
                          AND [fk].[is_not_trusted] = 1
                        """,
                        tableName)
                    .ToListAsync();

                if (untrustedConstraints.Count == 0)
                {
                    logger.LogWarning(exception, "Constraint trust validation failed for table {TableName}.", tableName);
                    continue;
                }

                foreach (var row in untrustedConstraints)
                {
                    logger.LogWarning(
                        exception,
                        "Constraint {ConstraintName} on table {TableName} could not be validated. Existing data may violate FK constraints.",
                        row.ConstraintName,
                        tableName);
                }
            }
        }
    }

    private static string GetConstraintValidationSql(string tableName)
    {
        return tableName switch
        {
            "Users" => "ALTER TABLE [dbo].[Users] WITH CHECK CHECK CONSTRAINT ALL;",
            "AuditLogs" => "ALTER TABLE [dbo].[AuditLogs] WITH CHECK CHECK CONSTRAINT ALL;",
            "InternTasks" => "ALTER TABLE [dbo].[InternTasks] WITH CHECK CHECK CONSTRAINT ALL;",
            "PasswordResetTokens" => "ALTER TABLE [dbo].[PasswordResetTokens] WITH CHECK CHECK CONSTRAINT ALL;",
            "InternProfiles" => "ALTER TABLE [dbo].[InternProfiles] WITH CHECK CHECK CONSTRAINT ALL;",
            "InternProfileSkills" => "ALTER TABLE [dbo].[InternProfileSkills] WITH CHECK CHECK CONSTRAINT ALL;",
            "Notifications" => "ALTER TABLE [dbo].[Notifications] WITH CHECK CHECK CONSTRAINT ALL;",
            "MissionHistoryEntries" => "ALTER TABLE [dbo].[MissionHistoryEntries] WITH CHECK CHECK CONSTRAINT ALL;",
            "DeliverableVersions" => "ALTER TABLE [dbo].[DeliverableVersions] WITH CHECK CHECK CONSTRAINT ALL;",
            _ => throw new InvalidOperationException($"Unsupported table for constraint validation: {tableName}")
        };
    }

    private static IReadOnlyList<string> SplitSqlBatches(string sql)
    {
        var batches = new List<string>();
        var builder = new StringBuilder();

        var normalized = sql.Replace("\r\n", "\n", StringComparison.Ordinal);
        var lines = normalized.Split('\n');

        foreach (var line in lines)
        {
            if (Regex.IsMatch(line, "^\\s*GO\\s*(--.*)?$", RegexOptions.IgnoreCase))
            {
                var batch = builder.ToString().Trim();
                if (batch.Length > 0)
                {
                    batches.Add(batch);
                }

                builder.Clear();
                continue;
            }

            builder.AppendLine(line);
        }

        var finalBatch = builder.ToString().Trim();
        if (finalBatch.Length > 0)
        {
            batches.Add(finalBatch);
        }

        return batches;
    }

    private sealed class ConstraintNameProjection
    {
        public string ConstraintName { get; init; } = string.Empty;
    }
}
