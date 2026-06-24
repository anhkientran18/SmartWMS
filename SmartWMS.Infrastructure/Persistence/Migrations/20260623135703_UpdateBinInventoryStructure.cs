using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateBinInventoryStructure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BinInventories_BatchNumber",
                table: "BinInventories");

            migrationBuilder.DropIndex(
                name: "IX_BinInventories_BinId_ProductId_BatchNumber_Status",
                table: "BinInventories");

            migrationBuilder.DropIndex(
                name: "IX_BinInventories_ExpiryDate",
                table: "BinInventories");

            migrationBuilder.DropColumn(
                name: "BatchNumber",
                table: "BinInventories");

            migrationBuilder.DropColumn(
                name: "ExpiryDate",
                table: "BinInventories");

            migrationBuilder.DropColumn(
                name: "StockStatus",
                table: "BinInventories");

            migrationBuilder.AlterColumn<string>(
                name: "LotNumber",
                table: "BinInventories",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateIndex(
                name: "IX_BinInventories_BinId_ProductId_LotNumber_Status",
                table: "BinInventories",
                columns: new[] { "BinId", "ProductId", "LotNumber", "Status" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BinInventories_ExpirationDate",
                table: "BinInventories",
                column: "ExpirationDate");

            migrationBuilder.CreateIndex(
                name: "IX_BinInventories_LotNumber",
                table: "BinInventories",
                column: "LotNumber");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BinInventories_BinId_ProductId_LotNumber_Status",
                table: "BinInventories");

            migrationBuilder.DropIndex(
                name: "IX_BinInventories_ExpirationDate",
                table: "BinInventories");

            migrationBuilder.DropIndex(
                name: "IX_BinInventories_LotNumber",
                table: "BinInventories");

            migrationBuilder.AlterColumn<string>(
                name: "LotNumber",
                table: "BinInventories",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AddColumn<string>(
                name: "BatchNumber",
                table: "BinInventories",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiryDate",
                table: "BinInventories",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StockStatus",
                table: "BinInventories",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_BinInventories_BatchNumber",
                table: "BinInventories",
                column: "BatchNumber");

            migrationBuilder.CreateIndex(
                name: "IX_BinInventories_BinId_ProductId_BatchNumber_Status",
                table: "BinInventories",
                columns: new[] { "BinId", "ProductId", "BatchNumber", "Status" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BinInventories_ExpiryDate",
                table: "BinInventories",
                column: "ExpiryDate");
        }
    }
}
