-- Axia Intern Manager
-- Intern lifecycle migration
-- Date: 2026-04-01

SET NOCOUNT ON;

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

-- Legacy mapping rule requested:
-- active -> ACTIVE
-- anything else -> INCOMPLETE
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
