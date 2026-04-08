-- Axia Intern Manager
-- Intern onboarding schema migration
-- Date: 2026-04-07

SET NOCOUNT ON;

IF COL_LENGTH('dbo.Users', 'VerificationStatus') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD [VerificationStatus] NVARCHAR(32) NOT NULL
        CONSTRAINT [DF_Users_VerificationStatus] DEFAULT N'INCOMPLETE';
END

GO

IF OBJECT_ID(N'[dbo].[InternProfiles]', N'U') IS NOT NULL
BEGIN
    DECLARE @HasLegacyStatus BIT = CASE WHEN COL_LENGTH('dbo.InternProfiles', 'Status') IS NULL THEN 0 ELSE 1 END;
    DECLARE @HasLegacySchool BIT = CASE WHEN COL_LENGTH('dbo.InternProfiles', 'School') IS NULL THEN 0 ELSE 1 END;
    DECLARE @HasLegacyUniversity BIT = CASE WHEN COL_LENGTH('dbo.InternProfiles', 'University') IS NULL THEN 0 ELSE 1 END;
    DECLARE @HasLegacySpecialty BIT = CASE WHEN COL_LENGTH('dbo.InternProfiles', 'Specialty') IS NULL THEN 0 ELSE 1 END;
    DECLARE @HasLegacyExperience BIT = CASE WHEN COL_LENGTH('dbo.InternProfiles', 'Experience') IS NULL THEN 0 ELSE 1 END;
    DECLARE @HasCvFileUrl BIT = CASE WHEN COL_LENGTH('dbo.InternProfiles', 'CvFileUrl') IS NULL THEN 0 ELSE 1 END;

    DECLARE @BackfillSql NVARCHAR(MAX) = N'
        UPDATE [u]
        SET [u].[VerificationStatus] = CASE' +
        CASE WHEN @HasLegacyStatus = 1
            THEN N' WHEN UPPER(LTRIM(RTRIM(ISNULL([p].[Status], N'''')))) IN (N''PENDING'', N''ACTIVE'', N''COMPLETED'', N''ARCHIVED'') THEN N''PENDING'''
            ELSE N'' END +
        CASE WHEN @HasCvFileUrl = 1
            THEN N' WHEN NULLIF(LTRIM(RTRIM(ISNULL([p].[CvFileUrl], N''''))), N'''') IS NOT NULL THEN N''PENDING'''
            ELSE N'' END +
        CASE WHEN @HasLegacySchool = 1
            THEN N' WHEN NULLIF(LTRIM(RTRIM(ISNULL([p].[School], N''''))), N'''') IS NOT NULL THEN N''PENDING'''
            ELSE N'' END +
        CASE WHEN @HasLegacyUniversity = 1
            THEN N' WHEN NULLIF(LTRIM(RTRIM(ISNULL([p].[University], N''''))), N'''') IS NOT NULL THEN N''PENDING'''
            ELSE N'' END +
        CASE WHEN @HasLegacySpecialty = 1
            THEN N' WHEN NULLIF(LTRIM(RTRIM(ISNULL([p].[Specialty], N''''))), N'''') IS NOT NULL THEN N''PENDING'''
            ELSE N'' END +
        CASE WHEN @HasLegacyExperience = 1
            THEN N' WHEN NULLIF(LTRIM(RTRIM(ISNULL([p].[Experience], N''''))), N'''') IS NOT NULL THEN N''PENDING'''
            ELSE N'' END +
        N' ELSE N''INCOMPLETE''
        END
        FROM [dbo].[Users] AS [u]
        LEFT JOIN [dbo].[InternProfiles] AS [p]
            ON [p].[InternId] = [u].[Id]
        WHERE [u].[Role] = N''Intern'';';

    EXEC sp_executesql @BackfillSql;
END
ELSE
BEGIN
    UPDATE [dbo].[Users]
    SET [VerificationStatus] = N'INCOMPLETE'
    WHERE [Role] = N'Intern';
END

UPDATE [dbo].[Users]
SET [VerificationStatus] = N'NOT_APPLICABLE'
WHERE [Role] <> N'Intern';

UPDATE [dbo].[Users]
SET [VerificationStatus] = N'INCOMPLETE'
WHERE [Role] = N'Intern'
  AND UPPER(LTRIM(RTRIM(ISNULL([VerificationStatus], N'')))) NOT IN (N'INCOMPLETE', N'PENDING', N'ACTIVE');

IF COL_LENGTH('dbo.InternProfiles', 'Specialty') IS NOT NULL
   AND COL_LENGTH('dbo.InternProfiles', 'Major') IS NULL
BEGIN
    EXEC sp_rename N'dbo.InternProfiles.Specialty', N'Major', N'COLUMN';
END

IF COL_LENGTH('dbo.InternProfiles', 'ExpectedGraduation') IS NOT NULL
   AND COL_LENGTH('dbo.InternProfiles', 'ExpectedGraduationDate') IS NULL
BEGIN
    EXEC sp_rename N'dbo.InternProfiles.ExpectedGraduation', N'ExpectedGraduationDate', N'COLUMN';
END

IF COL_LENGTH('dbo.InternProfiles', 'UniversityId') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [UniversityId] UNIQUEIDENTIFIER NULL;
END

IF COL_LENGTH('dbo.InternProfiles', 'Major') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [Major] NVARCHAR(200) NOT NULL
        CONSTRAINT [DF_InternProfiles_Major] DEFAULT N'';
END

IF COL_LENGTH('dbo.InternProfiles', 'CurrentYearOfStudy') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [CurrentYearOfStudy] NVARCHAR(64) NOT NULL
        CONSTRAINT [DF_InternProfiles_CurrentYearOfStudy] DEFAULT N'';
END

IF COL_LENGTH('dbo.InternProfiles', 'ExpectedGraduationDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [ExpectedGraduationDate] DATETIME2 NULL;
END

IF COL_LENGTH('dbo.InternProfiles', 'WorkPreference') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [WorkPreference] NVARCHAR(16) NULL;
END

IF COL_LENGTH('dbo.InternProfiles', 'CvFileUrl') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [CvFileUrl] NVARCHAR(2048) NULL;
END

IF COL_LENGTH('dbo.InternProfiles', 'StartDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [StartDate] DATETIME2 NULL;
END

IF COL_LENGTH('dbo.InternProfiles', 'EndDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles]
    ADD [EndDate] DATETIME2 NULL;
END

GO

IF COL_LENGTH('dbo.InternProfiles', 'UniversityId') IS NOT NULL
   AND COL_LENGTH('dbo.InternProfiles', 'University') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE [p]
        SET [p].[UniversityId] = [s].[Id]
        FROM [dbo].[InternProfiles] AS [p]
        INNER JOIN [dbo].[Schools] AS [s]
            ON UPPER(LTRIM(RTRIM([s].[Name]))) = UPPER(LTRIM(RTRIM([p].[University])))
        WHERE [p].[UniversityId] IS NULL
          AND NULLIF(LTRIM(RTRIM(ISNULL([p].[University], N''''))), N'''') IS NOT NULL;';
END

IF COL_LENGTH('dbo.InternProfiles', 'UniversityId') IS NOT NULL
   AND COL_LENGTH('dbo.InternProfiles', 'School') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE [p]
        SET [p].[UniversityId] = [s].[Id]
        FROM [dbo].[InternProfiles] AS [p]
        INNER JOIN [dbo].[Schools] AS [s]
            ON UPPER(LTRIM(RTRIM([s].[Name]))) = UPPER(LTRIM(RTRIM([p].[School])))
        WHERE [p].[UniversityId] IS NULL
          AND NULLIF(LTRIM(RTRIM(ISNULL([p].[School], N''''))), N'''') IS NOT NULL;';
END

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_InternProfiles_Status_StartDate')
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [CK_InternProfiles_Status_StartDate];
END

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternProfiles]') AND name = N'IX_InternProfiles_Status')
BEGIN
    DROP INDEX [IX_InternProfiles_Status] ON [dbo].[InternProfiles];
END

DECLARE @ConstraintName NVARCHAR(128);

SET @ConstraintName = NULL;
SELECT @ConstraintName = [dc].[name]
FROM [sys].[default_constraints] AS [dc]
INNER JOIN [sys].[columns] AS [c]
    ON [c].[default_object_id] = [dc].[object_id]
INNER JOIN [sys].[tables] AS [t]
    ON [t].[object_id] = [c].[object_id]
WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'CompetenciesJson';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @ConstraintName + N']');
END

IF COL_LENGTH('dbo.InternProfiles', 'CompetenciesJson') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP COLUMN [CompetenciesJson];
END

SET @ConstraintName = NULL;
SELECT @ConstraintName = [dc].[name]
FROM [sys].[default_constraints] AS [dc]
INNER JOIN [sys].[columns] AS [c]
    ON [c].[default_object_id] = [dc].[object_id]
INNER JOIN [sys].[tables] AS [t]
    ON [t].[object_id] = [c].[object_id]
WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'Experience';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @ConstraintName + N']');
END

IF COL_LENGTH('dbo.InternProfiles', 'Experience') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP COLUMN [Experience];
END

SET @ConstraintName = NULL;
SELECT @ConstraintName = [dc].[name]
FROM [sys].[default_constraints] AS [dc]
INNER JOIN [sys].[columns] AS [c]
    ON [c].[default_object_id] = [dc].[object_id]
INNER JOIN [sys].[tables] AS [t]
    ON [t].[object_id] = [c].[object_id]
WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'Specialty';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @ConstraintName + N']');
END

IF COL_LENGTH('dbo.InternProfiles', 'Specialty') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP COLUMN [Specialty];
END

SET @ConstraintName = NULL;
SELECT @ConstraintName = [dc].[name]
FROM [sys].[default_constraints] AS [dc]
INNER JOIN [sys].[columns] AS [c]
    ON [c].[default_object_id] = [dc].[object_id]
INNER JOIN [sys].[tables] AS [t]
    ON [t].[object_id] = [c].[object_id]
WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'Status';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @ConstraintName + N']');
END

IF COL_LENGTH('dbo.InternProfiles', 'Status') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP COLUMN [Status];
END

SET @ConstraintName = NULL;
SELECT @ConstraintName = [dc].[name]
FROM [sys].[default_constraints] AS [dc]
INNER JOIN [sys].[columns] AS [c]
    ON [c].[default_object_id] = [dc].[object_id]
INNER JOIN [sys].[tables] AS [t]
    ON [t].[object_id] = [c].[object_id]
WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'University';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @ConstraintName + N']');
END

IF COL_LENGTH('dbo.InternProfiles', 'University') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP COLUMN [University];
END

SET @ConstraintName = NULL;
SELECT @ConstraintName = [dc].[name]
FROM [sys].[default_constraints] AS [dc]
INNER JOIN [sys].[columns] AS [c]
    ON [c].[default_object_id] = [dc].[object_id]
INNER JOIN [sys].[tables] AS [t]
    ON [t].[object_id] = [c].[object_id]
WHERE [t].[name] = N'InternProfiles' AND [c].[name] = N'School';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [' + @ConstraintName + N']');
END

IF COL_LENGTH('dbo.InternProfiles', 'School') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP COLUMN [School];
END

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_InternProfiles_WorkPreference')
BEGIN
    ALTER TABLE [dbo].[InternProfiles] DROP CONSTRAINT [CK_InternProfiles_WorkPreference];
END

ALTER TABLE [dbo].[InternProfiles]
ADD CONSTRAINT [CK_InternProfiles_WorkPreference]
    CHECK (([WorkPreference] IS NULL) OR ([WorkPreference] IN (N'remote', N'hybrid', N'onsite')));

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = N'IX_Users_Role_VerificationStatus')
BEGIN
    CREATE INDEX [IX_Users_Role_VerificationStatus] ON [dbo].[Users]([Role], [VerificationStatus]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InternProfiles]') AND name = N'IX_InternProfiles_UniversityId')
BEGIN
    CREATE INDEX [IX_InternProfiles_UniversityId] ON [dbo].[InternProfiles]([UniversityId]);
END

IF COL_LENGTH('dbo.InternProfiles', 'UniversityId') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InternProfiles_Schools_UniversityId')
BEGIN
    ALTER TABLE [dbo].[InternProfiles] WITH CHECK
    ADD CONSTRAINT [FK_InternProfiles_Schools_UniversityId]
        FOREIGN KEY ([UniversityId]) REFERENCES [dbo].[Schools]([Id]) ON DELETE NO ACTION;
END
