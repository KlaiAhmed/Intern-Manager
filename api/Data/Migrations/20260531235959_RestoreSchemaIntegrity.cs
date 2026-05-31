using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RestoreSchemaIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE [Missions]
                SET [InternId] = NULL
                WHERE [InternId] IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM [Users] AS [u]
                        WHERE [u].[Id] = [Missions].[InternId]
                    );
                """);

            migrationBuilder.Sql(
                """
                UPDATE [Deliverables]
                SET [InternId] = NULL
                WHERE [InternId] IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM [Users] AS [u]
                        WHERE [u].[Id] = [Deliverables].[InternId]
                    );
                """);

            migrationBuilder.Sql(
                """
                UPDATE [MissionHistoryEntries]
                SET [ChangedByUserId] = NULL
                WHERE [ChangedByUserId] IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM [Users] AS [u]
                        WHERE [u].[Id] = [MissionHistoryEntries].[ChangedByUserId]
                    );
                """);

            migrationBuilder.Sql(
                """
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Evaluations_Users_InternId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Evaluations] AS [e]
                        WHERE [e].[InternId] IS NOT NULL
                            AND NOT EXISTS (
                                SELECT 1
                                FROM [Users] AS [u]
                                WHERE [u].[Id] = [e].[InternId]
                            )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_Evaluations_Users_InternId because orphan rows exist in [Evaluations].[InternId].', 1;
                    END;

                    ALTER TABLE [Evaluations] WITH CHECK ADD CONSTRAINT [FK_Evaluations_Users_InternId]
                        FOREIGN KEY([InternId]) REFERENCES [Users]([Id]) ON DELETE NO ACTION;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Evaluations] WITH CHECK CHECK CONSTRAINT [FK_Evaluations_Users_InternId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Evaluations_Users_SupervisorId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Evaluations] AS [e]
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM [Users] AS [u]
                            WHERE [u].[Id] = [e].[SupervisorId]
                        )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_Evaluations_Users_SupervisorId because orphan rows exist in [Evaluations].[SupervisorId].', 1;
                    END;

                    ALTER TABLE [Evaluations] WITH CHECK ADD CONSTRAINT [FK_Evaluations_Users_SupervisorId]
                        FOREIGN KEY([SupervisorId]) REFERENCES [Users]([Id]) ON DELETE NO ACTION;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Evaluations] WITH CHECK CHECK CONSTRAINT [FK_Evaluations_Users_SupervisorId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_JournalEntries_Users_InternId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [JournalEntries] AS [j]
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM [Users] AS [u]
                            WHERE [u].[Id] = [j].[InternId]
                        )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_JournalEntries_Users_InternId because orphan rows exist in [JournalEntries].[InternId].', 1;
                    END;

                    ALTER TABLE [JournalEntries] WITH CHECK ADD CONSTRAINT [FK_JournalEntries_Users_InternId]
                        FOREIGN KEY([InternId]) REFERENCES [Users]([Id]) ON DELETE CASCADE;
                END
                ELSE
                BEGIN
                    ALTER TABLE [JournalEntries] WITH CHECK CHECK CONSTRAINT [FK_JournalEntries_Users_InternId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Meetings_Users_InternId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Meetings] AS [m]
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM [Users] AS [u]
                            WHERE [u].[Id] = [m].[InternId]
                        )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_Meetings_Users_InternId because orphan rows exist in [Meetings].[InternId].', 1;
                    END;

                    ALTER TABLE [Meetings] WITH CHECK ADD CONSTRAINT [FK_Meetings_Users_InternId]
                        FOREIGN KEY([InternId]) REFERENCES [Users]([Id]) ON DELETE NO ACTION;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Meetings] WITH CHECK CHECK CONSTRAINT [FK_Meetings_Users_InternId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Meetings_Users_SupervisorId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Meetings] AS [m]
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM [Users] AS [u]
                            WHERE [u].[Id] = [m].[SupervisorId]
                        )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_Meetings_Users_SupervisorId because orphan rows exist in [Meetings].[SupervisorId].', 1;
                    END;

                    ALTER TABLE [Meetings] WITH CHECK ADD CONSTRAINT [FK_Meetings_Users_SupervisorId]
                        FOREIGN KEY([SupervisorId]) REFERENCES [Users]([Id]) ON DELETE NO ACTION;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Meetings] WITH CHECK CHECK CONSTRAINT [FK_Meetings_Users_SupervisorId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Missions_Users_InternId')
                BEGIN
                    ALTER TABLE [Missions] WITH CHECK ADD CONSTRAINT [FK_Missions_Users_InternId]
                        FOREIGN KEY([InternId]) REFERENCES [Users]([Id]) ON DELETE NO ACTION;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Missions] WITH CHECK CHECK CONSTRAINT [FK_Missions_Users_InternId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Missions_Users_SupervisorId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Missions] AS [m]
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM [Users] AS [u]
                            WHERE [u].[Id] = [m].[SupervisorId]
                        )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_Missions_Users_SupervisorId because orphan rows exist in [Missions].[SupervisorId].', 1;
                    END;

                    ALTER TABLE [Missions] WITH CHECK ADD CONSTRAINT [FK_Missions_Users_SupervisorId]
                        FOREIGN KEY([SupervisorId]) REFERENCES [Users]([Id]) ON DELETE NO ACTION;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Missions] WITH CHECK CHECK CONSTRAINT [FK_Missions_Users_SupervisorId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Deliverables_Missions_MissionId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Deliverables] AS [d]
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM [Missions] AS [m]
                            WHERE [m].[Id] = [d].[MissionId]
                        )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_Deliverables_Missions_MissionId because orphan rows exist in [Deliverables].[MissionId].', 1;
                    END;

                    ALTER TABLE [Deliverables] WITH CHECK ADD CONSTRAINT [FK_Deliverables_Missions_MissionId]
                        FOREIGN KEY([MissionId]) REFERENCES [Missions]([Id]) ON DELETE CASCADE;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Deliverables] WITH CHECK CHECK CONSTRAINT [FK_Deliverables_Missions_MissionId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Deliverables_Users_InternId')
                BEGIN
                    ALTER TABLE [Deliverables] WITH CHECK ADD CONSTRAINT [FK_Deliverables_Users_InternId]
                        FOREIGN KEY([InternId]) REFERENCES [Users]([Id]) ON DELETE SET NULL;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Deliverables] WITH CHECK CHECK CONSTRAINT [FK_Deliverables_Users_InternId];
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Deliverables_Users_SupervisorId')
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Deliverables] AS [d]
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM [Users] AS [u]
                            WHERE [u].[Id] = [d].[SupervisorId]
                        )
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore FK_Deliverables_Users_SupervisorId because orphan rows exist in [Deliverables].[SupervisorId].', 1;
                    END;

                    ALTER TABLE [Deliverables] WITH CHECK ADD CONSTRAINT [FK_Deliverables_Users_SupervisorId]
                        FOREIGN KEY([SupervisorId]) REFERENCES [Users]([Id]) ON DELETE NO ACTION;
                END
                ELSE
                BEGIN
                    ALTER TABLE [Deliverables] WITH CHECK CHECK CONSTRAINT [FK_Deliverables_Users_SupervisorId];
                END;
                """);

            migrationBuilder.Sql(
                """
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Role_Status' AND object_id = OBJECT_ID(N'[dbo].[Users]'))
                BEGIN
                    CREATE INDEX [IX_Users_Role_Status] ON [Users] ([Role], [Status]);
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Role_DepartmentId_Status' AND object_id = OBJECT_ID(N'[dbo].[Users]'))
                BEGIN
                    CREATE INDEX [IX_Users_Role_DepartmentId_Status] ON [Users] ([Role], [DepartmentId], [Status]);
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Missions_CreatedAt' AND object_id = OBJECT_ID(N'[dbo].[Missions]'))
                BEGIN
                    CREATE INDEX [IX_Missions_CreatedAt] ON [Missions] ([CreatedAt]);
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MissionHistoryEntries_ChangedByUserId' AND object_id = OBJECT_ID(N'[dbo].[MissionHistoryEntries]'))
                BEGIN
                    CREATE INDEX [IX_MissionHistoryEntries_ChangedByUserId] ON [MissionHistoryEntries] ([ChangedByUserId]);
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_UserId_RelatedEntity_Type' AND object_id = OBJECT_ID(N'[dbo].[Notifications]'))
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM [Notifications] AS [n]
                        WHERE [n].[RelatedEntity] IS NOT NULL
                            AND [n].[Type] IN ('task.overdue', 'deliverable.overdue', 'mission.deadline_approaching')
                        GROUP BY [n].[UserId], [n].[RelatedEntity], [n].[Type]
                        HAVING COUNT(*) > 1
                    )
                    BEGIN
                        THROW 51000, 'Cannot restore IX_Notifications_UserId_RelatedEntity_Type because duplicate rows exist in the filtered key space.', 1;
                    END;

                    CREATE UNIQUE INDEX [IX_Notifications_UserId_RelatedEntity_Type]
                        ON [Notifications] ([UserId], [RelatedEntity], [Type])
                        WHERE [Type] IN ('task.overdue', 'deliverable.overdue', 'mission.deadline_approaching') AND [RelatedEntity] IS NOT NULL;
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_UserId_RelatedEntity_Type' AND object_id = OBJECT_ID(N'[dbo].[Notifications]'))
                BEGIN
                    DROP INDEX [IX_Notifications_UserId_RelatedEntity_Type] ON [Notifications];
                END;

                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MissionHistoryEntries_ChangedByUserId' AND object_id = OBJECT_ID(N'[dbo].[MissionHistoryEntries]'))
                BEGIN
                    DROP INDEX [IX_MissionHistoryEntries_ChangedByUserId] ON [MissionHistoryEntries];
                END;

                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Missions_CreatedAt' AND object_id = OBJECT_ID(N'[dbo].[Missions]'))
                BEGIN
                    DROP INDEX [IX_Missions_CreatedAt] ON [Missions];
                END;

                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Role_DepartmentId_Status' AND object_id = OBJECT_ID(N'[dbo].[Users]'))
                BEGIN
                    DROP INDEX [IX_Users_Role_DepartmentId_Status] ON [Users];
                END;

                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Role_Status' AND object_id = OBJECT_ID(N'[dbo].[Users]'))
                BEGIN
                    DROP INDEX [IX_Users_Role_Status] ON [Users];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Deliverables_Users_SupervisorId')
                BEGIN
                    ALTER TABLE [Deliverables] DROP CONSTRAINT [FK_Deliverables_Users_SupervisorId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Deliverables_Users_InternId')
                BEGIN
                    ALTER TABLE [Deliverables] DROP CONSTRAINT [FK_Deliverables_Users_InternId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Deliverables_Missions_MissionId')
                BEGIN
                    ALTER TABLE [Deliverables] DROP CONSTRAINT [FK_Deliverables_Missions_MissionId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Missions_Users_SupervisorId')
                BEGIN
                    ALTER TABLE [Missions] DROP CONSTRAINT [FK_Missions_Users_SupervisorId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Missions_Users_InternId')
                BEGIN
                    ALTER TABLE [Missions] DROP CONSTRAINT [FK_Missions_Users_InternId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Meetings_Users_SupervisorId')
                BEGIN
                    ALTER TABLE [Meetings] DROP CONSTRAINT [FK_Meetings_Users_SupervisorId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Meetings_Users_InternId')
                BEGIN
                    ALTER TABLE [Meetings] DROP CONSTRAINT [FK_Meetings_Users_InternId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_JournalEntries_Users_InternId')
                BEGIN
                    ALTER TABLE [JournalEntries] DROP CONSTRAINT [FK_JournalEntries_Users_InternId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Evaluations_Users_SupervisorId')
                BEGIN
                    ALTER TABLE [Evaluations] DROP CONSTRAINT [FK_Evaluations_Users_SupervisorId];
                END;

                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Evaluations_Users_InternId')
                BEGIN
                    ALTER TABLE [Evaluations] DROP CONSTRAINT [FK_Evaluations_Users_InternId];
                END;
                """);
        }
    }
}