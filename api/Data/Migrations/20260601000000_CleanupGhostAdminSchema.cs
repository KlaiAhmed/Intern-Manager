using InternManager.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260601000000_CleanupGhostAdminSchema")]
    public partial class CleanupGhostAdminSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NOT NULL
                BEGIN
                    DELETE FROM [dbo].[__EFMigrationsHistory]
                    WHERE [MigrationId] = N'20260409164140_AddAdminOperationsEndpoints';
                END;

                IF OBJECT_ID(N'[dbo].[AdminArchiveJobs]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [dbo].[AdminArchiveJobs];
                END;

                IF OBJECT_ID(N'[dbo].[AdminBiAccessPermissions]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [dbo].[AdminBiAccessPermissions];
                END;

                IF OBJECT_ID(N'[dbo].[AdminEmailTemplates]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [dbo].[AdminEmailTemplates];
                END;

                IF OBJECT_ID(N'[dbo].[AdminNotificationRules]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [dbo].[AdminNotificationRules];
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF OBJECT_ID(N'[dbo].[AdminArchiveJobs]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[AdminArchiveJobs] (
                        [Id] uniqueidentifier NOT NULL CONSTRAINT [PK_AdminArchiveJobs] PRIMARY KEY,
                        [Year] int NOT NULL,
                        [TriggeredBy] nvarchar(255) NOT NULL,
                        [TriggeredAt] datetime2 NOT NULL,
                        [Status] nvarchar(32) NOT NULL,
                        CONSTRAINT [DF_AdminArchiveJobs_Id] DEFAULT (newid()) FOR [Id],
                        CONSTRAINT [DF_AdminArchiveJobs_TriggeredAt] DEFAULT (getutcdate()) FOR [TriggeredAt]
                    );
                END;

                IF OBJECT_ID(N'[dbo].[AdminBiAccessPermissions]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[AdminBiAccessPermissions] (
                        [Role] nvarchar(32) NOT NULL,
                        [Dashboard] nvarchar(64) NOT NULL,
                        [Allowed] bit NOT NULL CONSTRAINT [DF_AdminBiAccessPermissions_Allowed] DEFAULT (CONVERT([bit], (0))),
                        CONSTRAINT [PK_AdminBiAccessPermissions] PRIMARY KEY ([Role], [Dashboard])
                    );
                END;

                IF OBJECT_ID(N'[dbo].[AdminEmailTemplates]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[AdminEmailTemplates] (
                        [Id] uniqueidentifier NOT NULL CONSTRAINT [PK_AdminEmailTemplates] PRIMARY KEY,
                        [Name] nvarchar(120) NOT NULL,
                        [Subject] nvarchar(300) NOT NULL,
                        [Body] nvarchar(max) NOT NULL,
                        CONSTRAINT [DF_AdminEmailTemplates_Id] DEFAULT (newid()) FOR [Id]
                    );
                END;

                IF OBJECT_ID(N'[dbo].[AdminNotificationRules]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[AdminNotificationRules] (
                        [Id] uniqueidentifier NOT NULL CONSTRAINT [PK_AdminNotificationRules] PRIMARY KEY,
                        [Name] nvarchar(160) NOT NULL,
                        [Trigger] nvarchar(160) NOT NULL,
                        [Enabled] bit NOT NULL CONSTRAINT [DF_AdminNotificationRules_Enabled] DEFAULT (CONVERT([bit], (1))),
                        CONSTRAINT [DF_AdminNotificationRules_Id] DEFAULT (newid()) FOR [Id]
                    );
                END;

                IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NOT NULL
                   AND NOT EXISTS (
                       SELECT 1
                       FROM [dbo].[__EFMigrationsHistory]
                       WHERE [MigrationId] = N'20260409164140_AddAdminOperationsEndpoints')
                BEGIN
                    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
                    VALUES (N'20260409164140_AddAdminOperationsEndpoints', N'10.0.5');
                END;
                """);
        }
    }
}
