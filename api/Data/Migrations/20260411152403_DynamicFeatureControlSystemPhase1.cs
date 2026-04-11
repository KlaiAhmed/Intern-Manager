using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DynamicFeatureControlSystemPhase1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsReviewed",
                table: "JournalEntries",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsReleasedToIntern",
                table: "Evaluations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReleasedAt",
                table: "Evaluations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReleasedByUserId",
                table: "Evaluations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InternNotifications",
                columns: table => new
                {
                    NotificationId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InternId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    RelatedEntityId = table.Column<int>(type: "int", nullable: true),
                    IsRead = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternNotifications", x => x.NotificationId);
                    table.ForeignKey(
                        name: "FK_InternNotifications_Users_InternId",
                        column: x => x.InternId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "JournalComments",
                columns: table => new
                {
                    JournalCommentId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    JournalEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalComments", x => x.JournalCommentId);
                    table.ForeignKey(
                        name: "FK_JournalComments_JournalEntries_JournalEntryId",
                        column: x => x.JournalEntryId,
                        principalTable: "JournalEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_JournalComments_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "JournalEvaluationLinks",
                columns: table => new
                {
                    JournalEvaluationLinkId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    JournalEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EvaluationCriteria = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    LinkedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalEvaluationLinks", x => x.JournalEvaluationLinkId);
                    table.ForeignKey(
                        name: "FK_JournalEvaluationLinks_JournalEntries_JournalEntryId",
                        column: x => x.JournalEntryId,
                        principalTable: "JournalEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_JournalEvaluationLinks_Users_LinkedByUserId",
                        column: x => x.LinkedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MissionFeatureFlags",
                columns: table => new
                {
                    MissionFeatureFlagsId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MissionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MissionCardConfig = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MissionFeatureFlags", x => x.MissionFeatureFlagsId);
                    table.CheckConstraint("CK_MissionFeatureFlags_MissionCardConfig_IsJson", "ISJSON([MissionCardConfig]) = 1");
                    table.ForeignKey(
                        name: "FK_MissionFeatureFlags_Missions_MissionId",
                        column: x => x.MissionId,
                        principalTable: "Missions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MissionFeatureFlags_Users_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_InternId_IsReleasedToIntern",
                table: "Evaluations",
                columns: new[] { "InternId", "IsReleasedToIntern" });

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_ReleasedByUserId",
                table: "Evaluations",
                column: "ReleasedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InternNotifications_InternId",
                table: "InternNotifications",
                column: "InternId");

            migrationBuilder.CreateIndex(
                name: "IX_InternNotifications_InternId_IsRead_CreatedAt",
                table: "InternNotifications",
                columns: new[] { "InternId", "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_JournalComments_AuthorId",
                table: "JournalComments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalComments_CreatedAt",
                table: "JournalComments",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_JournalComments_JournalEntryId",
                table: "JournalComments",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEvaluationLinks_JournalEntryId",
                table: "JournalEvaluationLinks",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEvaluationLinks_JournalEntryId_EvaluationCriteria",
                table: "JournalEvaluationLinks",
                columns: new[] { "JournalEntryId", "EvaluationCriteria" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_JournalEvaluationLinks_LinkedByUserId",
                table: "JournalEvaluationLinks",
                column: "LinkedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MissionFeatureFlags_MissionId",
                table: "MissionFeatureFlags",
                column: "MissionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MissionFeatureFlags_UpdatedByUserId",
                table: "MissionFeatureFlags",
                column: "UpdatedByUserId");

            const string defaultMissionCardConfig = "{\"missionOverview\":{\"isVisible\":true,\"isInteractive\":true,\"requirementConfig\":null},\"quickStats\":{\"isVisible\":true,\"isInteractive\":true,\"requirementConfig\":null},\"tasks\":{\"isVisible\":true,\"isInteractive\":true,\"requirementConfig\":null},\"deliverables\":{\"isVisible\":true,\"isInteractive\":true,\"requirementConfig\":null},\"evaluation\":{\"isVisible\":true,\"isInteractive\":true,\"requirementConfig\":null},\"journal\":{\"isVisible\":true,\"isInteractive\":true,\"requirementConfig\":null},\"meeting\":{\"isVisible\":true,\"isInteractive\":true,\"requirementConfig\":null}}";

            migrationBuilder.Sql($@"
INSERT INTO [MissionFeatureFlags] ([MissionId], [MissionCardConfig], [CreatedAt], [UpdatedAt], [UpdatedByUserId])
SELECT [m].[Id], '{defaultMissionCardConfig}', GETUTCDATE(), GETUTCDATE(), NULL
FROM [Missions] AS [m]
WHERE NOT EXISTS (
    SELECT 1
    FROM [MissionFeatureFlags] AS [mf]
    WHERE [mf].[MissionId] = [m].[Id]
);");

            migrationBuilder.AddForeignKey(
                name: "FK_Evaluations_Users_ReleasedByUserId",
                table: "Evaluations",
                column: "ReleasedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Evaluations_Users_ReleasedByUserId",
                table: "Evaluations");

            migrationBuilder.DropTable(
                name: "InternNotifications");

            migrationBuilder.DropTable(
                name: "JournalComments");

            migrationBuilder.DropTable(
                name: "JournalEvaluationLinks");

            migrationBuilder.DropTable(
                name: "MissionFeatureFlags");

            migrationBuilder.DropIndex(
                name: "IX_Evaluations_InternId_IsReleasedToIntern",
                table: "Evaluations");

            migrationBuilder.DropIndex(
                name: "IX_Evaluations_ReleasedByUserId",
                table: "Evaluations");

            migrationBuilder.DropColumn(
                name: "IsReviewed",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "IsReleasedToIntern",
                table: "Evaluations");

            migrationBuilder.DropColumn(
                name: "ReleasedAt",
                table: "Evaluations");

            migrationBuilder.DropColumn(
                name: "ReleasedByUserId",
                table: "Evaluations");
        }
    }
}
