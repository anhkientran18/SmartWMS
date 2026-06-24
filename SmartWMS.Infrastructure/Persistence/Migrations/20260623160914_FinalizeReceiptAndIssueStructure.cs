using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FinalizeReceiptAndIssueStructure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InboundReceipts_Products_ProductId",
                table: "InboundReceipts");

            migrationBuilder.DropForeignKey(
                name: "FK_OutboundIssues_Products_ProductId",
                table: "OutboundIssues");

            migrationBuilder.DropIndex(
                name: "IX_OutboundIssues_ProductId",
                table: "OutboundIssues");

            migrationBuilder.DropIndex(
                name: "IX_InboundReceipts_ProductId",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "InboundReceipts");

            migrationBuilder.AddColumn<Guid>(
                name: "OutboundIssueId",
                table: "OutboundOrderItems",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CustomerId",
                table: "OutboundIssues",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                table: "InboundReceipts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DeliveryAddress = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Address = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OutboundOrderItems_OutboundIssueId",
                table: "OutboundOrderItems",
                column: "OutboundIssueId");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundIssues_CustomerId",
                table: "OutboundIssues",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_InboundReceipts_SupplierId",
                table: "InboundReceipts",
                column: "SupplierId");

            migrationBuilder.AddForeignKey(
                name: "FK_InboundReceipts_Suppliers_SupplierId",
                table: "InboundReceipts",
                column: "SupplierId",
                principalTable: "Suppliers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OutboundIssues_Customers_CustomerId",
                table: "OutboundIssues",
                column: "CustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OutboundOrderItems_OutboundIssues_OutboundIssueId",
                table: "OutboundOrderItems",
                column: "OutboundIssueId",
                principalTable: "OutboundIssues",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InboundReceipts_Suppliers_SupplierId",
                table: "InboundReceipts");

            migrationBuilder.DropForeignKey(
                name: "FK_OutboundIssues_Customers_CustomerId",
                table: "OutboundIssues");

            migrationBuilder.DropForeignKey(
                name: "FK_OutboundOrderItems_OutboundIssues_OutboundIssueId",
                table: "OutboundOrderItems");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_OutboundOrderItems_OutboundIssueId",
                table: "OutboundOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_OutboundIssues_CustomerId",
                table: "OutboundIssues");

            migrationBuilder.DropIndex(
                name: "IX_InboundReceipts_SupplierId",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "OutboundIssueId",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "InboundReceipts");

            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                table: "OutboundIssues",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "OutboundIssues",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                table: "InboundReceipts",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "InboundReceipts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_OutboundIssues_ProductId",
                table: "OutboundIssues",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_InboundReceipts_ProductId",
                table: "InboundReceipts",
                column: "ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_InboundReceipts_Products_ProductId",
                table: "InboundReceipts",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OutboundIssues_Products_ProductId",
                table: "OutboundIssues",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
