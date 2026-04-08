using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AuditRemediationFollowup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserStatusReferences");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "Missions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "InternshipTypeId",
                table: "Missions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartDate",
                table: "Missions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Token = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Token);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserAccountStatusReferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAccountStatusReferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserVerificationStatusReferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserVerificationStatusReferences", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Missions_InternshipTypeId",
                table: "Missions",
                column: "InternshipTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                table: "RefreshTokens",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAccountStatusReferences_Name",
                table: "UserAccountStatusReferences",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserVerificationStatusReferences_Name",
                table: "UserVerificationStatusReferences",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Missions_InternshipTypes_InternshipTypeId",
                table: "Missions",
                column: "InternshipTypeId",
                principalTable: "InternshipTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Missions_InternshipTypes_InternshipTypeId",
                table: "Missions");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "UserAccountStatusReferences");

            migrationBuilder.DropTable(
                name: "UserVerificationStatusReferences");

            migrationBuilder.DropIndex(
                name: "IX_Missions_InternshipTypeId",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "InternshipTypeId",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "Missions");

            migrationBuilder.CreateTable(
                name: "UserStatusReferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStatusReferences", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserStatusReferences_Name",
                table: "UserStatusReferences",
                column: "Name",
                unique: true);
        }
    }
}
