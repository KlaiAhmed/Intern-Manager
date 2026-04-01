/// <summary>
/// 📁 Emplacement : api/Data/DbSeeder.cs
/// 🎯 Rôle       : Initialise les données minimales nécessaires au démarrage, notamment le compte SuperAdmin.
/// 📦 Contient   : [DbSeeder]
/// </summary>
using InternManager.Api.Common.Enums;
using InternManager.Api.Models.Entities;
using InternManager.Api.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Data;

/// <summary>
/// Regroupe les opérations d amorçage de données exécutées au démarrage de l application.
/// </summary>
public static class DbSeeder
{
    /// <summary>
    /// Vérifie la présence d un compte SuperAdmin et le crée si nécessaire.
    /// </summary>
    /// <param name="services">Fournisseur de services racine pour créer un scope d exécution.</param>
    /// <returns>Une tâche asynchrone représentant la fin de l opération d amorçage.</returns>
    /// <exception cref="InvalidOperationException">
    /// Levée quand une variable d environnement obligatoire `SUPERADMIN_*` est absente.
    /// </exception>
    public static async Task SeedSuperAdminAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("DbSeeder");

        await EnsureReferentialTablesExistAsync(dbContext);
        await EnsureSharedRouterSchemaAsync(dbContext);
        await EnsureSupervisorRouterSchemaAsync(dbContext);
        await EnsureInternRouterSchemaAsync(dbContext);
        await EnsureExtendedFeatureSchemaAsync(dbContext);
        await EnsureInternLifecycleSchemaAsync(dbContext);

        await SeedDefaultStatusReferencesAsync(dbContext, logger);

        var superAdminExists = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => u.Role == UserRole.SuperAdmin);

        if (superAdminExists)
        {
            logger.LogInformation("SuperAdmin already exists.");
            return;
        }

        var email = GetRequiredValue(configuration, "SUPERADMIN_EMAIL");
        var password = GetRequiredValue(configuration, "SUPERADMIN_PASSWORD");
        var firstName = GetRequiredValue(configuration, "SUPERADMIN_FIRSTNAME");
        var lastName = GetRequiredValue(configuration, "SUPERADMIN_LASTNAME");

        var user = new User
        {
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            PasswordHash = PasswordHasher.HashPassword(password),
            Role = UserRole.SuperAdmin,
            Status = UserStatus.Active
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("SuperAdmin created successfully.");
    }

    /// <summary>
    /// Cree les tables de referentiel manquantes sur une base existante lorsque EnsureCreated ne peut plus faire evoluer le schema.
    /// </summary>
    private static async Task EnsureReferentialTablesExistAsync(AppDbContext dbContext)
    {
        var tableNames = new[]
        {
            "Departments",
            "Schools",
            "InternshipTypes",
            "Skills",
            "UserStatusReferences"
        };

        foreach (var tableName in tableNames)
        {
            var createTableSql = $"""
                IF OBJECT_ID(N'[dbo].[{tableName}]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[{tableName}] (
                        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_{tableName}] PRIMARY KEY DEFAULT NEWID(),
                        [Name] NVARCHAR(120) NOT NULL,
                        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_{tableName}_CreatedAt] DEFAULT GETUTCDATE(),
                        [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_{tableName}_UpdatedAt] DEFAULT GETUTCDATE()
                    );

                    CREATE UNIQUE INDEX [IX_{tableName}_Name] ON [dbo].[{tableName}] ([Name]);
                END
                """;

            await dbContext.Database.ExecuteSqlRawAsync(createTableSql);
        }
    }

    /// <summary>
    /// Fait evoluer le schema minimal du routeur partage sur les bases existantes.
    /// </summary>
    private static Task EnsureSharedRouterSchemaAsync(AppDbContext dbContext)
    {
        const string sql = """
            IF COL_LENGTH('dbo.Users', 'DepartmentId') IS NULL
            BEGIN
                ALTER TABLE [dbo].[Users] ADD [DepartmentId] UNIQUEIDENTIFIER NULL;
            END

            IF COL_LENGTH('dbo.Users', 'LastLoginAt') IS NULL
            BEGIN
                ALTER TABLE [dbo].[Users] ADD [LastLoginAt] DATETIME2 NULL;
            END

            IF OBJECT_ID(N'[dbo].[AuditLogs]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[AuditLogs] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_AuditLogs] PRIMARY KEY DEFAULT NEWID(),
                    [ActorUserId] UNIQUEIDENTIFIER NULL,
                    [Actor] NVARCHAR(255) NOT NULL,
                    [Action] NVARCHAR(200) NOT NULL,
                    [Entity] NVARCHAR(300) NULL,
                    [Timestamp] DATETIME2 NOT NULL CONSTRAINT [DF_AuditLogs_Timestamp] DEFAULT GETUTCDATE()
                );
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = N'IX_Users_DepartmentId')
            BEGIN
                CREATE INDEX [IX_Users_DepartmentId] ON [dbo].[Users]([DepartmentId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[AuditLogs]') AND name = N'IX_AuditLogs_Timestamp')
            BEGIN
                CREATE INDEX [IX_AuditLogs_Timestamp] ON [dbo].[AuditLogs]([Timestamp]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[AuditLogs]') AND name = N'IX_AuditLogs_ActorUserId')
            BEGIN
                CREATE INDEX [IX_AuditLogs_ActorUserId] ON [dbo].[AuditLogs]([ActorUserId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Users_Departments_DepartmentId')
            BEGIN
                ALTER TABLE [dbo].[Users] WITH NOCHECK
                ADD CONSTRAINT [FK_Users_Departments_DepartmentId]
                    FOREIGN KEY ([DepartmentId]) REFERENCES [dbo].[Departments]([Id]) ON DELETE SET NULL;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_AuditLogs_Users_ActorUserId')
            BEGIN
                ALTER TABLE [dbo].[AuditLogs] WITH NOCHECK
                ADD CONSTRAINT [FK_AuditLogs_Users_ActorUserId]
                    FOREIGN KEY ([ActorUserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE SET NULL;
            END
            """;

        return dbContext.Database.ExecuteSqlRawAsync(sql);
    }

    /// <summary>
    /// Cree les tables du routeur supervisor sur les bases deja existantes.
    /// </summary>
    private static Task EnsureSupervisorRouterSchemaAsync(AppDbContext dbContext)
    {
        const string sql = """
            IF OBJECT_ID(N'[dbo].[Missions]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Missions] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Missions] PRIMARY KEY DEFAULT NEWID(),
                    [SupervisorId] UNIQUEIDENTIFIER NOT NULL,
                    [InternId] UNIQUEIDENTIFIER NULL,
                    [Title] NVARCHAR(200) NOT NULL,
                    [Description] NVARCHAR(4000) NOT NULL CONSTRAINT [DF_Missions_Description] DEFAULT N'',
                    [SkillsJson] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_Missions_SkillsJson] DEFAULT N'[]',
                    [Tools] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_Missions_Tools] DEFAULT N'',
                    [Level] NVARCHAR(64) NOT NULL CONSTRAINT [DF_Missions_Level] DEFAULT N'',
                    [Status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_Missions_Status] DEFAULT N'active',
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Missions_CreatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[Deliverables]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Deliverables] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Deliverables] PRIMARY KEY DEFAULT NEWID(),
                    [MissionId] UNIQUEIDENTIFIER NOT NULL,
                    [SupervisorId] UNIQUEIDENTIFIER NOT NULL,
                    [InternId] UNIQUEIDENTIFIER NULL,
                    [Title] NVARCHAR(200) NOT NULL,
                    [Status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_Deliverables_Status] DEFAULT N'pending',
                    [SubmittedDate] DATETIME2 NULL,
                    [FileUrl] NVARCHAR(2048) NOT NULL CONSTRAINT [DF_Deliverables_FileUrl] DEFAULT N'',
                    [Version] INT NOT NULL CONSTRAINT [DF_Deliverables_Version] DEFAULT 1,
                    [SupervisorComment] NVARCHAR(2000) NULL,
                    [Progress] INT NOT NULL CONSTRAINT [DF_Deliverables_Progress] DEFAULT 0,
                    [DueDate] DATETIME2 NULL,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Deliverables_CreatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[Evaluations]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Evaluations] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Evaluations] PRIMARY KEY DEFAULT NEWID(),
                    [SupervisorId] UNIQUEIDENTIFIER NOT NULL,
                    [InternId] UNIQUEIDENTIFIER NOT NULL,
                    [Type] NVARCHAR(32) NOT NULL,
                    [Technical] INT NOT NULL CONSTRAINT [DF_Evaluations_Technical] DEFAULT 0,
                    [Autonomy] INT NOT NULL CONSTRAINT [DF_Evaluations_Autonomy] DEFAULT 0,
                    [Communication] INT NOT NULL CONSTRAINT [DF_Evaluations_Communication] DEFAULT 0,
                    [DeadlineRespect] INT NOT NULL CONSTRAINT [DF_Evaluations_DeadlineRespect] DEFAULT 0,
                    [DeliverableQuality] INT NOT NULL CONSTRAINT [DF_Evaluations_DeliverableQuality] DEFAULT 0,
                    [Comments] NVARCHAR(3000) NOT NULL CONSTRAINT [DF_Evaluations_Comments] DEFAULT N'',
                    [Status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_Evaluations_Status] DEFAULT N'pending',
                    [SubmittedAt] DATETIME2 NULL,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Evaluations_CreatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[Meetings]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Meetings] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Meetings] PRIMARY KEY DEFAULT NEWID(),
                    [SupervisorId] UNIQUEIDENTIFIER NOT NULL,
                    [InternId] UNIQUEIDENTIFIER NOT NULL,
                    [Date] DATETIME2 NOT NULL,
                    [Notes] NVARCHAR(3000) NOT NULL CONSTRAINT [DF_Meetings_Notes] DEFAULT N'',
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Meetings_CreatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[JournalEntries]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[JournalEntries] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_JournalEntries] PRIMARY KEY DEFAULT NEWID(),
                    [InternId] UNIQUEIDENTIFIER NOT NULL,
                    [Content] NVARCHAR(4000) NOT NULL,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_JournalEntries_CreatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Missions]') AND name = N'IX_Missions_SupervisorId')
            BEGIN
                CREATE INDEX [IX_Missions_SupervisorId] ON [dbo].[Missions]([SupervisorId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Missions]') AND name = N'IX_Missions_InternId')
            BEGIN
                CREATE INDEX [IX_Missions_InternId] ON [dbo].[Missions]([InternId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Deliverables]') AND name = N'IX_Deliverables_MissionId')
            BEGIN
                CREATE INDEX [IX_Deliverables_MissionId] ON [dbo].[Deliverables]([MissionId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Deliverables]') AND name = N'IX_Deliverables_SupervisorId')
            BEGIN
                CREATE INDEX [IX_Deliverables_SupervisorId] ON [dbo].[Deliverables]([SupervisorId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Deliverables]') AND name = N'IX_Deliverables_InternId')
            BEGIN
                CREATE INDEX [IX_Deliverables_InternId] ON [dbo].[Deliverables]([InternId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Deliverables]') AND name = N'IX_Deliverables_Status')
            BEGIN
                CREATE INDEX [IX_Deliverables_Status] ON [dbo].[Deliverables]([Status]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Evaluations]') AND name = N'IX_Evaluations_SupervisorId')
            BEGIN
                CREATE INDEX [IX_Evaluations_SupervisorId] ON [dbo].[Evaluations]([SupervisorId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Evaluations]') AND name = N'IX_Evaluations_InternId')
            BEGIN
                CREATE INDEX [IX_Evaluations_InternId] ON [dbo].[Evaluations]([InternId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Evaluations]') AND name = N'IX_Evaluations_Status')
            BEGIN
                CREATE INDEX [IX_Evaluations_Status] ON [dbo].[Evaluations]([Status]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Evaluations]') AND name = N'IX_Evaluations_SupervisorId_InternId_Type')
            BEGIN
                CREATE UNIQUE INDEX [IX_Evaluations_SupervisorId_InternId_Type]
                ON [dbo].[Evaluations]([SupervisorId], [InternId], [Type]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Meetings]') AND name = N'IX_Meetings_SupervisorId')
            BEGIN
                CREATE INDEX [IX_Meetings_SupervisorId] ON [dbo].[Meetings]([SupervisorId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Meetings]') AND name = N'IX_Meetings_InternId')
            BEGIN
                CREATE INDEX [IX_Meetings_InternId] ON [dbo].[Meetings]([InternId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Meetings]') AND name = N'IX_Meetings_Date')
            BEGIN
                CREATE INDEX [IX_Meetings_Date] ON [dbo].[Meetings]([Date]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[JournalEntries]') AND name = N'IX_JournalEntries_InternId')
            BEGIN
                CREATE INDEX [IX_JournalEntries_InternId] ON [dbo].[JournalEntries]([InternId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[JournalEntries]') AND name = N'IX_JournalEntries_CreatedAt')
            BEGIN
                CREATE INDEX [IX_JournalEntries_CreatedAt] ON [dbo].[JournalEntries]([CreatedAt]);
            END
            """;

        return dbContext.Database.ExecuteSqlRawAsync(sql);
    }

    /// <summary>
    /// Cree les tables du routeur intern sur les bases deja existantes.
    /// </summary>
    private static Task EnsureInternRouterSchemaAsync(AppDbContext dbContext)
    {
        const string sql = """
            IF OBJECT_ID(N'[dbo].[InternTasks]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[InternTasks] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_InternTasks] PRIMARY KEY DEFAULT NEWID(),
                    [InternId] UNIQUEIDENTIFIER NOT NULL,
                    [DeliverableId] UNIQUEIDENTIFIER NULL,
                    [Title] NVARCHAR(250) NOT NULL,
                    [DueDate] DATETIME2 NULL,
                    [IsComplete] BIT NOT NULL CONSTRAINT [DF_InternTasks_IsComplete] DEFAULT 0,
                    [CompletedAt] DATETIME2 NULL,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_InternTasks_CreatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternTasks]') AND name = N'IX_InternTasks_InternId')
            BEGIN
                CREATE INDEX [IX_InternTasks_InternId] ON [dbo].[InternTasks]([InternId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternTasks]') AND name = N'IX_InternTasks_DeliverableId')
            BEGIN
                CREATE INDEX [IX_InternTasks_DeliverableId] ON [dbo].[InternTasks]([DeliverableId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternTasks]') AND name = N'IX_InternTasks_DueDate')
            BEGIN
                CREATE INDEX [IX_InternTasks_DueDate] ON [dbo].[InternTasks]([DueDate]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InternTasks_Users_InternId')
            BEGIN
                ALTER TABLE [dbo].[InternTasks] WITH NOCHECK
                ADD CONSTRAINT [FK_InternTasks_Users_InternId]
                    FOREIGN KEY ([InternId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InternTasks_Deliverables_DeliverableId')
            BEGIN
                ALTER TABLE [dbo].[InternTasks] WITH NOCHECK
                ADD CONSTRAINT [FK_InternTasks_Deliverables_DeliverableId]
                    FOREIGN KEY ([DeliverableId]) REFERENCES [dbo].[Deliverables]([Id]) ON DELETE SET NULL;
            END
            """;

        return dbContext.Database.ExecuteSqlRawAsync(sql);
    }

    /// <summary>
    /// Cree les tables additionnelles introduites par les evolutions fonctionnelles sur une base deja existante.
    /// </summary>
    private static Task EnsureExtendedFeatureSchemaAsync(AppDbContext dbContext)
    {
        const string sql = """
            IF OBJECT_ID(N'[dbo].[PasswordResetTokens]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[PasswordResetTokens] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_PasswordResetTokens] PRIMARY KEY DEFAULT NEWID(),
                    [UserId] UNIQUEIDENTIFIER NOT NULL,
                    [TokenHash] NVARCHAR(128) NOT NULL,
                    [ExpiresAt] DATETIME2 NOT NULL,
                    [UsedAt] DATETIME2 NULL,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_PasswordResetTokens_CreatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[InternProfiles]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[InternProfiles] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_InternProfiles] PRIMARY KEY DEFAULT NEWID(),
                    [InternId] UNIQUEIDENTIFIER NOT NULL,
                    [School] NVARCHAR(200) NOT NULL CONSTRAINT [DF_InternProfiles_School] DEFAULT N'',
                    [Specialty] NVARCHAR(200) NOT NULL CONSTRAINT [DF_InternProfiles_Specialty] DEFAULT N'',
                    [CompetenciesJson] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_InternProfiles_CompetenciesJson] DEFAULT N'[]',
                    [Experience] NVARCHAR(3000) NOT NULL CONSTRAINT [DF_InternProfiles_Experience] DEFAULT N'',
                    [CvFileUrl] NVARCHAR(2048) NULL,
                    [Status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_InternProfiles_Status] DEFAULT N'INCOMPLETE',
                    [StartDate] DATETIME2 NULL,
                    [EndDate] DATETIME2 NULL,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_InternProfiles_CreatedAt] DEFAULT GETUTCDATE(),
                    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_InternProfiles_UpdatedAt] DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[InternProfileSkills]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[InternProfileSkills] (
                    [InternProfileId] UNIQUEIDENTIFIER NOT NULL,
                    [SkillId] UNIQUEIDENTIFIER NOT NULL,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_InternProfileSkills_CreatedAt] DEFAULT GETUTCDATE(),
                    CONSTRAINT [PK_InternProfileSkills] PRIMARY KEY ([InternProfileId], [SkillId])
                );
            END

            IF OBJECT_ID(N'[dbo].[Notifications]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Notifications] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Notifications] PRIMARY KEY DEFAULT NEWID(),
                    [UserId] UNIQUEIDENTIFIER NOT NULL,
                    [Type] NVARCHAR(64) NOT NULL,
                    [Title] NVARCHAR(200) NOT NULL CONSTRAINT [DF_Notifications_Title] DEFAULT N'',
                    [Message] NVARCHAR(2000) NOT NULL,
                    [RelatedEntity] NVARCHAR(300) NULL,
                    [IsRead] BIT NOT NULL CONSTRAINT [DF_Notifications_IsRead] DEFAULT 0,
                    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT GETUTCDATE(),
                    [ReadAt] DATETIME2 NULL
                );
            END

            IF OBJECT_ID(N'[dbo].[MissionHistoryEntries]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[MissionHistoryEntries] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_MissionHistoryEntries] PRIMARY KEY DEFAULT NEWID(),
                    [MissionId] UNIQUEIDENTIFIER NOT NULL,
                    [Field] NVARCHAR(120) NOT NULL,
                    [OldValue] NVARCHAR(2000) NULL,
                    [NewValue] NVARCHAR(2000) NULL,
                    [ChangedByUserId] UNIQUEIDENTIFIER NULL,
                    [ChangedBy] NVARCHAR(255) NOT NULL,
                    [ChangedAt] DATETIME2 NOT NULL CONSTRAINT [DF_MissionHistoryEntries_ChangedAt] DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[DeliverableVersions]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[DeliverableVersions] (
                    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_DeliverableVersions] PRIMARY KEY DEFAULT NEWID(),
                    [DeliverableId] UNIQUEIDENTIFIER NOT NULL,
                    [VersionNumber] INT NOT NULL,
                    [FileUrl] NVARCHAR(2048) NOT NULL,
                    [Status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_DeliverableVersions_Status] DEFAULT N'submitted',
                    [SupervisorComment] NVARCHAR(2000) NULL,
                    [SubmittedAt] DATETIME2 NOT NULL CONSTRAINT [DF_DeliverableVersions_SubmittedAt] DEFAULT GETUTCDATE(),
                    [ValidatedAt] DATETIME2 NULL
                );
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[PasswordResetTokens]') AND name = N'IX_PasswordResetTokens_TokenHash')
            BEGIN
                CREATE UNIQUE INDEX [IX_PasswordResetTokens_TokenHash] ON [dbo].[PasswordResetTokens]([TokenHash]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[PasswordResetTokens]') AND name = N'IX_PasswordResetTokens_UserId_ExpiresAt')
            BEGIN
                CREATE INDEX [IX_PasswordResetTokens_UserId_ExpiresAt] ON [dbo].[PasswordResetTokens]([UserId], [ExpiresAt]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternProfiles]') AND name = N'IX_InternProfiles_InternId')
            BEGIN
                CREATE UNIQUE INDEX [IX_InternProfiles_InternId] ON [dbo].[InternProfiles]([InternId]);
            END

            IF COL_LENGTH('dbo.InternProfiles', 'Status') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternProfiles]') AND name = N'IX_InternProfiles_Status')
            BEGIN
                CREATE INDEX [IX_InternProfiles_Status] ON [dbo].[InternProfiles]([Status]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Notifications]') AND name = N'IX_Notifications_UserId')
            BEGIN
                CREATE INDEX [IX_Notifications_UserId] ON [dbo].[Notifications]([UserId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Notifications]') AND name = N'IX_Notifications_UserId_IsRead_CreatedAt')
            BEGIN
                CREATE INDEX [IX_Notifications_UserId_IsRead_CreatedAt] ON [dbo].[Notifications]([UserId], [IsRead], [CreatedAt]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[MissionHistoryEntries]') AND name = N'IX_MissionHistoryEntries_MissionId')
            BEGIN
                CREATE INDEX [IX_MissionHistoryEntries_MissionId] ON [dbo].[MissionHistoryEntries]([MissionId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[MissionHistoryEntries]') AND name = N'IX_MissionHistoryEntries_ChangedAt')
            BEGIN
                CREATE INDEX [IX_MissionHistoryEntries_ChangedAt] ON [dbo].[MissionHistoryEntries]([ChangedAt]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[DeliverableVersions]') AND name = N'IX_DeliverableVersions_DeliverableId')
            BEGIN
                CREATE INDEX [IX_DeliverableVersions_DeliverableId] ON [dbo].[DeliverableVersions]([DeliverableId]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[DeliverableVersions]') AND name = N'IX_DeliverableVersions_DeliverableId_VersionNumber')
            BEGIN
                CREATE UNIQUE INDEX [IX_DeliverableVersions_DeliverableId_VersionNumber] ON [dbo].[DeliverableVersions]([DeliverableId], [VersionNumber]);
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_PasswordResetTokens_Users_UserId')
            BEGIN
                ALTER TABLE [dbo].[PasswordResetTokens] WITH NOCHECK
                ADD CONSTRAINT [FK_PasswordResetTokens_Users_UserId]
                    FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InternProfiles_Users_InternId')
            BEGIN
                ALTER TABLE [dbo].[InternProfiles] WITH NOCHECK
                ADD CONSTRAINT [FK_InternProfiles_Users_InternId]
                    FOREIGN KEY ([InternId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InternProfileSkills_InternProfiles_InternProfileId')
            BEGIN
                ALTER TABLE [dbo].[InternProfileSkills] WITH NOCHECK
                ADD CONSTRAINT [FK_InternProfileSkills_InternProfiles_InternProfileId]
                    FOREIGN KEY ([InternProfileId]) REFERENCES [dbo].[InternProfiles]([Id]) ON DELETE CASCADE;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InternProfileSkills_Skills_SkillId')
            BEGIN
                ALTER TABLE [dbo].[InternProfileSkills] WITH NOCHECK
                ADD CONSTRAINT [FK_InternProfileSkills_Skills_SkillId]
                    FOREIGN KEY ([SkillId]) REFERENCES [dbo].[Skills]([Id]) ON DELETE NO ACTION;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Notifications_Users_UserId')
            BEGIN
                ALTER TABLE [dbo].[Notifications] WITH NOCHECK
                ADD CONSTRAINT [FK_Notifications_Users_UserId]
                    FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_MissionHistoryEntries_Missions_MissionId')
            BEGIN
                ALTER TABLE [dbo].[MissionHistoryEntries] WITH NOCHECK
                ADD CONSTRAINT [FK_MissionHistoryEntries_Missions_MissionId]
                    FOREIGN KEY ([MissionId]) REFERENCES [dbo].[Missions]([Id]) ON DELETE CASCADE;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_MissionHistoryEntries_Users_ChangedByUserId')
            BEGIN
                ALTER TABLE [dbo].[MissionHistoryEntries] WITH NOCHECK
                ADD CONSTRAINT [FK_MissionHistoryEntries_Users_ChangedByUserId]
                    FOREIGN KEY ([ChangedByUserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE SET NULL;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_DeliverableVersions_Deliverables_DeliverableId')
            BEGIN
                ALTER TABLE [dbo].[DeliverableVersions] WITH NOCHECK
                ADD CONSTRAINT [FK_DeliverableVersions_Deliverables_DeliverableId]
                    FOREIGN KEY ([DeliverableId]) REFERENCES [dbo].[Deliverables]([Id]) ON DELETE CASCADE;
            END

            INSERT INTO [dbo].[DeliverableVersions] ([Id], [DeliverableId], [VersionNumber], [FileUrl], [Status], [SupervisorComment], [SubmittedAt], [ValidatedAt])
            SELECT NEWID(),
                   [d].[Id],
                   CASE WHEN [d].[Version] < 1 THEN 1 ELSE [d].[Version] END,
                   [d].[FileUrl],
                   CASE WHEN LTRIM(RTRIM(ISNULL([d].[Status], N''))) = N'' THEN N'submitted' ELSE [d].[Status] END,
                   [d].[SupervisorComment],
                   ISNULL([d].[SubmittedDate], GETUTCDATE()),
                   CASE WHEN [d].[Status] IN (N'accepted', N'rejected') THEN GETUTCDATE() ELSE NULL END
            FROM [dbo].[Deliverables] AS [d]
            WHERE LTRIM(RTRIM(ISNULL([d].[FileUrl], N''))) <> N''
              AND NOT EXISTS (
                  SELECT 1
                  FROM [dbo].[DeliverableVersions] AS [dv]
                  WHERE [dv].[DeliverableId] = [d].[Id]
              );
            """;

        return dbContext.Database.ExecuteSqlRawAsync(sql);
    }

    private static async Task EnsureInternLifecycleSchemaAsync(AppDbContext dbContext)
    {
        const string addColumnsSql = """
            IF COL_LENGTH('dbo.InternProfiles', 'Status') IS NULL
            BEGIN
                ALTER TABLE [dbo].[InternProfiles]
                ADD [Status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_InternProfiles_Status] DEFAULT N'INCOMPLETE';
            END

            IF COL_LENGTH('dbo.InternProfiles', 'StartDate') IS NULL
            BEGIN
                ALTER TABLE [dbo].[InternProfiles] ADD [StartDate] DATETIME2 NULL;
            END

            IF COL_LENGTH('dbo.InternProfiles', 'EndDate') IS NULL
            BEGIN
                ALTER TABLE [dbo].[InternProfiles] ADD [EndDate] DATETIME2 NULL;
            END
            """;

        const string finalizeSql = """
            IF COL_LENGTH('dbo.InternProfiles', 'Status') IS NOT NULL
            BEGIN
                DECLARE @StartDateDefaultConstraintName NVARCHAR(128);
                SELECT @StartDateDefaultConstraintName = [dc].[name]
                FROM [sys].[default_constraints] AS [dc]
                INNER JOIN [sys].[columns] AS [c]
                    ON [c].[default_object_id] = [dc].[object_id]
                INNER JOIN [sys].[tables] AS [t]
                    ON [t].[object_id] = [c].[object_id]
                WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'StartDate';

                IF @StartDateDefaultConstraintName IS NOT NULL
                BEGIN
                    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @StartDateDefaultConstraintName + N']');
                END

                DECLARE @EndDateDefaultConstraintName NVARCHAR(128);
                SELECT @EndDateDefaultConstraintName = [dc].[name]
                FROM [sys].[default_constraints] AS [dc]
                INNER JOIN [sys].[columns] AS [c]
                    ON [c].[default_object_id] = [dc].[object_id]
                INNER JOIN [sys].[tables] AS [t]
                    ON [t].[object_id] = [c].[object_id]
                WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'EndDate';

                IF @EndDateDefaultConstraintName IS NOT NULL
                BEGIN
                    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @EndDateDefaultConstraintName + N']');
                END

                UPDATE [p]
                SET [p].[Status] = CASE
                        WHEN UPPER(LTRIM(RTRIM(ISNULL([u].[Status], N'')))) = N'ACTIVE' THEN N'ACTIVE'
                        ELSE N'INCOMPLETE'
                    END
                FROM [dbo].[InternProfiles] AS [p]
                INNER JOIN [dbo].[Users] AS [u]
                    ON [u].[Id] = [p].[InternId]
                WHERE [p].[Status] IS NULL
                   OR UPPER(LTRIM(RTRIM([p].[Status]))) NOT IN (N'INCOMPLETE', N'PENDING', N'ACTIVE', N'COMPLETED', N'ARCHIVED');

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternProfiles]') AND name = N'IX_InternProfiles_Status')
                BEGIN
                    CREATE INDEX [IX_InternProfiles_Status] ON [dbo].[InternProfiles]([Status]);
                END

                IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_InternProfiles_Status_StartDate')
                BEGIN
                    ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [CK_InternProfiles_Status_StartDate];
                END

                ALTER TABLE [dbo].[InternProfiles]
                ADD CONSTRAINT [CK_InternProfiles_Status_StartDate]
                    CHECK (([Status] NOT IN (N'INCOMPLETE', N'PENDING')) OR ([StartDate] IS NULL AND [EndDate] IS NULL));
            END
            """;

        await dbContext.Database.ExecuteSqlRawAsync(addColumnsSql);
        await dbContext.Database.ExecuteSqlRawAsync(finalizeSql);
    }

    /// <summary>
    /// Ajoute les statuts utilisateurs par defaut utilises par l application.
    /// </summary>
    private static async Task SeedDefaultStatusReferencesAsync(AppDbContext dbContext, ILogger logger)
    {
        var defaultStatusNames = new[]
        {
            "incomplete",
            "pending",
            "active",
            "completed",
            "archived"
        };

        var existingNames = await dbContext.UserStatusReferences
            .AsNoTracking()
            .Select(status => status.Name.ToLower())
            .ToListAsync();

        var missingStatuses = defaultStatusNames
            .Where(defaultName => !existingNames.Contains(defaultName, StringComparer.OrdinalIgnoreCase))
            .Select(defaultName => new UserStatusReference { Name = defaultName })
            .ToList();

        if (missingStatuses.Count == 0)
        {
            return;
        }

        await dbContext.UserStatusReferences.AddRangeAsync(missingStatuses);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Seeded {Count} user status reference value(s).", missingStatuses.Count);
    }

    /// <summary>
    /// Lit une valeur de configuration obligatoire et échoue clairement si elle manque.
    /// </summary>
    /// <param name="configuration">Source de configuration applicative.</param>
    /// <param name="key">Nom de la clé à lire dans la configuration.</param>
    /// <returns>La valeur non vide associée à la clé demandée.</returns>
    /// <exception cref="InvalidOperationException">Levée si la clé est absente ou vide.</exception>
    private static string GetRequiredValue(IConfiguration configuration, string key)
    {
        var value = configuration[key];
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Required environment variable '{key}' is missing for SuperAdmin seeding.");
        }

        return value;
    }
}
