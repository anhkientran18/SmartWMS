using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCodeAndIsDeletedToZone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "Zones",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Zones",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Code",
                table: "Zones");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Zones");
        }
    }
}
