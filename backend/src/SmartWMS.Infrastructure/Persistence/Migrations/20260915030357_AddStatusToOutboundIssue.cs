using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusToOutboundIssue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InboundReceipts_Bins_BinId",
                table: "InboundReceipts");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpectedShipDate",
                table: "OutboundIssues",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "OutboundIssues",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OrderNumber",
                table: "OutboundIssues",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "OutboundIssues",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "OutboundIssues",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "BinId",
                table: "InboundReceipts",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpectedDeliveryDate",
                table: "InboundReceipts",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "InboundReceipts",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReceiptNumber",
                table: "InboundReceipts",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceDocument",
                table: "InboundReceipts",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "InboundReceipts",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "FK_InboundReceipts_Bins_BinId",
                table: "InboundReceipts",
                column: "BinId",
                principalTable: "Bins",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InboundReceipts_Bins_BinId",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "ExpectedShipDate",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "OrderNumber",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "ExpectedDeliveryDate",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "ReceiptNumber",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "ReferenceDocument",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "InboundReceipts");

            migrationBuilder.AlterColumn<Guid>(
                name: "BinId",
                table: "InboundReceipts",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_InboundReceipts_Bins_BinId",
                table: "InboundReceipts",
                column: "BinId",
                principalTable: "Bins",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
