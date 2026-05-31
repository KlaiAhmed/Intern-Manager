using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InternManager.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropInternTaskIsComplete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsComplete",
                table: "InternTasks");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsComplete",
                table: "InternTasks",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }
    }
}
