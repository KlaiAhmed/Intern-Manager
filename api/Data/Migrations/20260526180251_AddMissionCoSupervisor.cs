using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMissionCoSupervisor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CoSupervisorId",
                table: "Missions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Missions_CoSupervisorId",
                table: "Missions",
                column: "CoSupervisorId");

            migrationBuilder.AddForeignKey(
                name: "FK_Missions_Users_CoSupervisorId",
                table: "Missions",
                column: "CoSupervisorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Missions_Users_CoSupervisorId",
                table: "Missions");

            migrationBuilder.DropIndex(
                name: "IX_Missions_CoSupervisorId",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "CoSupervisorId",
                table: "Missions");
        }
    }
}
