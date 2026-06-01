using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveRedundantIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_JournalEvaluationLinks_JournalEntryId",
                table: "JournalEvaluationLinks");

            migrationBuilder.DropIndex(
                name: "IX_InternNotifications_InternId",
                table: "InternNotifications");

            migrationBuilder.DropIndex(
                name: "IX_Evaluations_InternId",
                table: "Evaluations");

            migrationBuilder.DropIndex(
                name: "IX_Evaluations_SupervisorId",
                table: "Evaluations");

            migrationBuilder.DropIndex(
                name: "IX_DeliverableVersions_DeliverableId",
                table: "DeliverableVersions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEvaluationLinks_JournalEntryId",
                table: "JournalEvaluationLinks",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_InternNotifications_InternId",
                table: "InternNotifications",
                column: "InternId");

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_InternId",
                table: "Evaluations",
                column: "InternId");

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_SupervisorId",
                table: "Evaluations",
                column: "SupervisorId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliverableVersions_DeliverableId",
                table: "DeliverableVersions",
                column: "DeliverableId");
        }
    }
}
