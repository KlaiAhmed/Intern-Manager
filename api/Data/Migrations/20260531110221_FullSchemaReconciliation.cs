using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class FullSchemaReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DeliverableId",
                table: "Evaluations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OverallScore",
                table: "Evaluations",
                type: "decimal(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrivateNotes",
                table: "Evaluations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCurrentVersion",
                table: "DeliverableVersions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "EntityHistoryEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    EntityType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntityHistoryEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EntityHistoryEntries_Users_ActorId",
                        column: x => x.ActorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_DeliverableId",
                table: "Evaluations",
                column: "DeliverableId",
                unique: true,
                filter: "[DeliverableId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EntityHistoryEntries_ActorId",
                table: "EntityHistoryEntries",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_EntityHistoryEntries_EntityType_EntityId_CreatedAt",
                table: "EntityHistoryEntries",
                columns: new[] { "EntityType", "EntityId", "CreatedAt" },
                descending: new[] { false, false, true });

            migrationBuilder.AddForeignKey(
                name: "FK_Evaluations_Deliverables_DeliverableId",
                table: "Evaluations",
                column: "DeliverableId",
                principalTable: "Deliverables",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Evaluations_Deliverables_DeliverableId",
                table: "Evaluations");

            migrationBuilder.DropTable(
                name: "EntityHistoryEntries");

            migrationBuilder.DropIndex(
                name: "IX_Evaluations_DeliverableId",
                table: "Evaluations");

            migrationBuilder.DropColumn(
                name: "DeliverableId",
                table: "Evaluations");

            migrationBuilder.DropColumn(
                name: "OverallScore",
                table: "Evaluations");

            migrationBuilder.DropColumn(
                name: "PrivateNotes",
                table: "Evaluations");

            migrationBuilder.DropColumn(
                name: "IsCurrentVersion",
                table: "DeliverableVersions");
        }
    }
}
