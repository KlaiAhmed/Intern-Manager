using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingModelColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime?>(
                name: "OverdueNotifiedAt",
                table: "Deliverables",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsLegacyAutoTask",
                table: "InternTasks",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime?>(
                name: "OverdueNotifiedAt",
                table: "InternTasks",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "InternTasks",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "todo");

            migrationBuilder.AddColumn<DateTime?>(
                name: "StatusChangedAt",
                table: "InternTasks",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OverdueNotifiedAt",
                table: "Deliverables");

            migrationBuilder.DropColumn(
                name: "IsLegacyAutoTask",
                table: "InternTasks");

            migrationBuilder.DropColumn(
                name: "OverdueNotifiedAt",
                table: "InternTasks");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "InternTasks");

            migrationBuilder.DropColumn(
                name: "StatusChangedAt",
                table: "InternTasks");
        }
    }
}
