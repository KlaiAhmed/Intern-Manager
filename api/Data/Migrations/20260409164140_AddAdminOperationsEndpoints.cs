using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminOperationsEndpoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminArchiveJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    Year = table.Column<int>(type: "int", nullable: false),
                    TriggeredBy = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    TriggeredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminArchiveJobs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AdminBiAccessPermissions",
                columns: table => new
                {
                    Role = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Dashboard = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Allowed = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminBiAccessPermissions", x => new { x.Role, x.Dashboard });
                });

            migrationBuilder.CreateTable(
                name: "AdminEmailTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminEmailTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AdminNotificationRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Trigger = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminNotificationRules", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminArchiveJobs_TriggeredAt",
                table: "AdminArchiveJobs",
                column: "TriggeredAt");

            migrationBuilder.CreateIndex(
                name: "IX_AdminArchiveJobs_Year",
                table: "AdminArchiveJobs",
                column: "Year",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdminEmailTemplates_Name",
                table: "AdminEmailTemplates",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdminNotificationRules_Name",
                table: "AdminNotificationRules",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdminNotificationRules_Trigger",
                table: "AdminNotificationRules",
                column: "Trigger",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminArchiveJobs");

            migrationBuilder.DropTable(
                name: "AdminBiAccessPermissions");

            migrationBuilder.DropTable(
                name: "AdminEmailTemplates");

            migrationBuilder.DropTable(
                name: "AdminNotificationRules");
        }
    }
}
