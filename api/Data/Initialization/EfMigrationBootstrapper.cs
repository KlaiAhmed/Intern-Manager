using Microsoft.EntityFrameworkCore;
using System.Data.Common;
using System.Data;
using System.Collections.Generic;

namespace InternManager.Api.Data.Initialization;

public static class EfMigrationBootstrapper
{
    private const string BaselineMigrationId = "20260407130510_InitialSchema";
    private const string EfProductVersion = "10.0.5";

    private sealed record MigrationSentinel(string MigrationId, string TableName, string? ColumnName, bool IsDropSentinel);

    // Sentinels chosen from migration Up() methods — used to detect whether a migration's
    // schema changes are already present in the database (so we can safely record them
    // in __EFMigrationsHistory as already-applied baseline entries).
    private static readonly List<MigrationSentinel> MigrationSentinels = new()
    {
        new MigrationSentinel("20260407134512_AuditRemediationFollowup", "RefreshTokens", null, false),
        new MigrationSentinel("20260409111151_AddSupervisorMaxCapacity", "Users", "MaxCapacity", false),
        new MigrationSentinel("20260411141456_PasswordResetCodeFlow", "PasswordResetTokens", "IsUsed", false),
        new MigrationSentinel("20260411152403_DynamicFeatureControlSystemPhase1", "MissionFeatureFlags", null, false),
        new MigrationSentinel("20260415171311_AddMissionInternAssignmentsAndInternPhone", "MissionInternAssignments", null, false),
        new MigrationSentinel("20260422144807_AddMissionTitleManuallySetFlag", "Missions", "IsTitleManuallySet", false),
        new MigrationSentinel("20260422185444_AddDescriptionToDeliverableAndTask", "Deliverables", "Description", false),
        new MigrationSentinel("20260526180251_AddMissionCoSupervisor", "Missions", "CoSupervisorId", false),
        new MigrationSentinel("20260526180646_AddDeliverableVersionSubmissionMetadata", "DeliverableVersions", "SubmittedByUserId", false),
        new MigrationSentinel("20260529114918_DropUnusedReferenceTables", "UserAccountStatusReferences", null, true),
        new MigrationSentinel("20260530120550_AddDeliverableWeight", "Deliverables", "Weight", false),
        new MigrationSentinel("20260530131821_DropDeliverableProgressInt", "Deliverables", "Progress", true),
        new MigrationSentinel("20260530132718_DropInternTaskIsComplete", "InternTasks", "IsComplete", true),
        new MigrationSentinel("20260531102134_AddMissingModelColumns", "InternTasks", "Status", false),
        new MigrationSentinel("20260531110221_FullSchemaReconciliation", "EntityHistoryEntries", null, false),
        new MigrationSentinel("20260531200000_AddMissingPhantomColumns", "Missions", "RawProgress", false),
    };

    public static async Task EnsureBaselineHistoryAsync(AppDbContext dbContext, ILogger logger, CancellationToken cancellationToken = default)
    {
        if (!await dbContext.Database.CanConnectAsync(cancellationToken))
        {
            return;
        }

        var sql = $"""
            IF OBJECT_ID(N'[dbo].[Departments]', N'U') IS NOT NULL
               AND OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
            BEGIN
                IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[__EFMigrationsHistory] (
                        [MigrationId] nvarchar(150) NOT NULL,
                        [ProductVersion] nvarchar(32) NOT NULL,
                        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
                    );
                END

                IF NOT EXISTS (
                    SELECT 1
                    FROM [dbo].[__EFMigrationsHistory]
                    WHERE [MigrationId] = N'{BaselineMigrationId}')
                BEGIN
                    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
                    VALUES (N'{BaselineMigrationId}', N'{EfProductVersion}');
                END
            END
            """;

        await dbContext.Database.ExecuteSqlRawAsync(sql, cancellationToken);
        logger.LogInformation("Checked EF baseline migration history bootstrap for existing schema compatibility.");

        // If the baseline migration was inserted (or already present), probe for further
        // migration sentinels and inject their entries into __EFMigrationsHistory when
        // the corresponding schema changes are already present.
        var connection = dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        // Ensure baseline exists before attempting to auto-inject subsequent migrations.
        await using (var checkCmd = connection.CreateCommand())
        {
            checkCmd.CommandText = "SELECT COUNT(1) FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = @mid";
            var p = checkCmd.CreateParameter(); p.ParameterName = "@mid"; p.Value = BaselineMigrationId;
            checkCmd.Parameters.Add(p);
            var baselineCount = Convert.ToInt32(await checkCmd.ExecuteScalarAsync(cancellationToken));
            if (baselineCount == 0)
            {
                // Baseline not present (unexpected given earlier SQL), skip sentinel probing.
                return;
            }
        }

        foreach (var sentinel in MigrationSentinels)
        {
            // Skip if migration already recorded.
            await using var existsCmd = connection.CreateCommand();
            existsCmd.CommandText = "SELECT COUNT(1) FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = @mid";
            var pExist = existsCmd.CreateParameter(); pExist.ParameterName = "@mid"; pExist.Value = sentinel.MigrationId;
            existsCmd.Parameters.Add(pExist);
            var already = Convert.ToInt32(await existsCmd.ExecuteScalarAsync(cancellationToken));
            if (already > 0)
            {
                logger.LogInformation("Bootstrapper: Migration {MigrationId} already present in history, skipping.", sentinel.MigrationId);
                continue;
            }

            bool sentinelMatches;
            if (!string.IsNullOrWhiteSpace(sentinel.ColumnName))
            {
                var colExists = await ColumnExistsAsync(connection, sentinel.TableName, sentinel.ColumnName);
                sentinelMatches = sentinel.IsDropSentinel ? !colExists : colExists;
            }
            else
            {
                var tableExists = await TableExistsAsync(connection, sentinel.TableName);
                sentinelMatches = sentinel.IsDropSentinel ? !tableExists : tableExists;
            }

            if (sentinelMatches)
            {
                await using var insertCmd = connection.CreateCommand();
                insertCmd.CommandText = "INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (@mid, @pv)";
                var p1 = insertCmd.CreateParameter(); p1.ParameterName = "@mid"; p1.Value = sentinel.MigrationId;
                var p2 = insertCmd.CreateParameter(); p2.ParameterName = "@pv"; p2.Value = EfProductVersion;
                insertCmd.Parameters.Add(p1); insertCmd.Parameters.Add(p2);
                await insertCmd.ExecuteNonQueryAsync(cancellationToken);
                logger.LogInformation("Bootstrapper: Injecting baseline for {MigrationId}", sentinel.MigrationId);
            }
            else
            {
                logger.LogInformation("Bootstrapper: Schema not yet at {MigrationId}, will apply via EF", sentinel.MigrationId);
            }
        }
    }

    private static async Task<bool> ColumnExistsAsync(DbConnection connection, string table, string column)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table AND COLUMN_NAME = @col";
        var p1 = cmd.CreateParameter(); p1.ParameterName = "@table"; p1.Value = table.Trim('[', ']');
        var p2 = cmd.CreateParameter(); p2.ParameterName = "@col"; p2.Value = column;
        cmd.Parameters.Add(p1); cmd.Parameters.Add(p2);
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<bool> TableExistsAsync(DbConnection connection, string table)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table";
        var p = cmd.CreateParameter(); p.ParameterName = "@table"; p.Value = table.Trim('[', ']');
        cmd.Parameters.Add(p);
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result) > 0;
    }
}
