using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingPhantomColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Missions
            migrationBuilder.AddColumn<decimal>(
                name: "RawProgress",
                table: "Missions",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "RowVersion",
                table: "Missions",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<bool>(
                name: "CoSupervisorCanReview",
                table: "Missions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CoSupervisorCanEval",
                table: "Missions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeadlineNotifiedAt",
                table: "Missions",
                type: "datetime2",
                nullable: true);

            // Deliverables
            migrationBuilder.AddColumn<decimal>(
                name: "RawProgress",
                table: "Deliverables",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "RowVersion",
                table: "Deliverables",
                type: "int",
                nullable: false,
                defaultValue: 1);

            // InternTasks
            migrationBuilder.AddColumn<int>(
                name: "RowVersion",
                table: "InternTasks",
                type: "int",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RawProgress",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "CoSupervisorCanReview",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "CoSupervisorCanEval",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "DeadlineNotifiedAt",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "RawProgress",
                table: "Deliverables");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Deliverables");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "InternTasks");
        }
    }
}
