using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PasswordResetCodeFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsUsed",
                table: "PasswordResetTokens",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                "UPDATE [PasswordResetTokens] SET [IsUsed] = CASE WHEN [UsedAt] IS NULL THEN 0 ELSE 1 END;");

            migrationBuilder.DropColumn(
                name: "UsedAt",
                table: "PasswordResetTokens");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "UsedAt",
                table: "PasswordResetTokens",
                type: "datetime2",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE [PasswordResetTokens] SET [UsedAt] = CASE WHEN [IsUsed] = 1 THEN GETUTCDATE() ELSE NULL END;");

            migrationBuilder.DropColumn(
                name: "IsUsed",
                table: "PasswordResetTokens");
        }
    }
}
