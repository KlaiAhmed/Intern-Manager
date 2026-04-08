using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data.Initialization;

public static class EfMigrationBootstrapper
{
    private const string BaselineMigrationId = "20260407130510_InitialSchema";
    private const string EfProductVersion = "10.0.5";

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
    }
}
