using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMissionInternAssignmentsAndInternPhone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "InternProfiles",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MissionInternAssignments",
                columns: table => new
                {
                    MissionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InternId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MissionInternAssignments", x => new { x.MissionId, x.InternId });
                    table.ForeignKey(
                        name: "FK_MissionInternAssignments_Missions_MissionId",
                        column: x => x.MissionId,
                        principalTable: "Missions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MissionInternAssignments_Users_InternId",
                        column: x => x.InternId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MissionInternAssignments_InternId",
                table: "MissionInternAssignments",
                column: "InternId");

                        // Backfill legacy single-intern assignments into the new join table.
                        migrationBuilder.Sql(
                                """
                                INSERT INTO [MissionInternAssignments] ([MissionId], [InternId], [AssignedAt])
                                SELECT [m].[Id], [m].[InternId], GETUTCDATE()
                                FROM [Missions] AS [m]
                                WHERE [m].[InternId] IS NOT NULL
                                    AND NOT EXISTS (
                                            SELECT 1
                                            FROM [MissionInternAssignments] AS [mia]
                                            WHERE [mia].[MissionId] = [m].[Id]
                                                AND [mia].[InternId] = [m].[InternId]
                                    );
                                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MissionInternAssignments");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "InternProfiles");
        }
    }
}
