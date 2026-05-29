using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliverableVersionSubmissionMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "FileUrl",
                table: "DeliverableVersions",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(2048)",
                oldMaxLength: 2048);

            migrationBuilder.AddColumn<string>(
                name: "GitHubBranch",
                table: "DeliverableVersions",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GitHubUrl",
                table: "DeliverableVersions",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Message",
                table: "DeliverableVersions",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedByUserId",
                table: "DeliverableVersions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliverableVersions_SubmittedByUserId",
                table: "DeliverableVersions",
                column: "SubmittedByUserId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_DeliverableVersions_SubmissionSource",
                table: "DeliverableVersions",
                sql: "(([FileUrl] IS NOT NULL AND [GitHubUrl] IS NULL) OR ([FileUrl] IS NULL AND [GitHubUrl] IS NOT NULL))");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliverableVersions_Users_SubmittedByUserId",
                table: "DeliverableVersions",
                column: "SubmittedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliverableVersions_Users_SubmittedByUserId",
                table: "DeliverableVersions");

            migrationBuilder.DropIndex(
                name: "IX_DeliverableVersions_SubmittedByUserId",
                table: "DeliverableVersions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_DeliverableVersions_SubmissionSource",
                table: "DeliverableVersions");

            migrationBuilder.DropColumn(
                name: "GitHubBranch",
                table: "DeliverableVersions");

            migrationBuilder.DropColumn(
                name: "GitHubUrl",
                table: "DeliverableVersions");

            migrationBuilder.DropColumn(
                name: "Message",
                table: "DeliverableVersions");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                table: "DeliverableVersions");

            migrationBuilder.AlterColumn<string>(
                name: "FileUrl",
                table: "DeliverableVersions",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(2048)",
                oldMaxLength: 2048,
                oldNullable: true);
        }
    }
}
