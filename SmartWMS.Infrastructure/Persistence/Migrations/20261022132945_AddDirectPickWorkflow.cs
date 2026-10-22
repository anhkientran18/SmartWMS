using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDirectPickWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryReservations_OutboundAllocations_AllocationId_OrderId",
                table: "InventoryReservations");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryReservations_OutboundOrderItems_OrderItemId_OrderId",
                table: "InventoryReservations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OutboundOrderItems_Progress",
                table: "OutboundOrderItems");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OutboundAllocations_Bins",
                table: "OutboundAllocations");

            migrationBuilder.DropIndex(
                name: "IX_InventoryReservations_AllocationId_OrderId",
                table: "InventoryReservations");

            migrationBuilder.DropIndex(
                name: "IX_InventoryReservations_OrderItemId_OrderId",
                table: "InventoryReservations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_InventoryReservations_Staging",
                table: "InventoryReservations");

            migrationBuilder.AddColumn<bool>(
                name: "IsDirectPick",
                table: "OutboundOrderItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<Guid>(
                name: "StagingBinId",
                table: "OutboundAllocations",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<bool>(
                name: "IsDirectPick",
                table: "OutboundAllocations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDirectPick",
                table: "InventoryReservations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SourceLotNumber", table: "InventoryReservations",
                type: "nvarchar(50)", maxLength: 50, nullable: true);
            migrationBuilder.AddColumn<DateTime>(
                name: "SourceExpirationDate", table: "InventoryReservations",
                type: "datetime2", nullable: true);
            migrationBuilder.AddUniqueConstraint(
                name: "AK_OutboundOrderItems_Id_OrderId_IsDirectPick",
                table: "OutboundOrderItems",
                columns: new[] { "Id", "OrderId", "IsDirectPick" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_OutboundAllocations_Id_OrderId_IsDirectPick",
                table: "OutboundAllocations",
                columns: new[] { "Id", "OrderId", "IsDirectPick" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_OutboundOrderItems_Progress",
                table: "OutboundOrderItems",
                sql: "[ReservedQuantity] >= 0 AND [ShippedQuantity] >= 0 AND (([IsDirectPick] = 0 AND [ShippedQuantity] <= [StagedQuantity] AND [StagedQuantity] <= [PickedQuantity]) OR ([IsDirectPick] = 1 AND [StagedQuantity] = 0 AND [PickedQuantity] >= 0 AND [ShippedQuantity] <= [PickedQuantity])) AND [PickedQuantity] <= [Quantity] AND [ReservedQuantity] <= [Quantity] - [ShippedQuantity]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_OutboundAllocations_Bins",
                table: "OutboundAllocations",
                sql: "([IsDirectPick] = 1 AND [StagingBinId] IS NULL) OR ([IsDirectPick] = 0 AND [StagingBinId] IS NOT NULL AND [SourceBinId] <> [StagingBinId])");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_AllocationId_OrderId_IsDirectPick",
                table: "InventoryReservations",
                columns: new[] { "AllocationId", "OrderId", "IsDirectPick" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_OrderItemId_OrderId_IsDirectPick",
                table: "InventoryReservations",
                columns: new[] { "OrderItemId", "OrderId", "IsDirectPick" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_InventoryReservations_Staging",
                table: "InventoryReservations",
                sql: "([IsDirectPick] = 1 AND [StagingBinInventoryId] IS NULL) OR ([IsDirectPick] = 0 AND ([StagingBinInventoryId] IS NULL OR [StagingBinInventoryId] <> [SourceBinInventoryId]) AND ([PickedQuantity] = 0 OR [StagingBinInventoryId] IS NOT NULL))");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryReservations_OutboundAllocations_AllocationId_OrderId_IsDirectPick",
                table: "InventoryReservations",
                columns: new[] { "AllocationId", "OrderId", "IsDirectPick" },
                principalTable: "OutboundAllocations",
                principalColumns: new[] { "Id", "OrderId", "IsDirectPick" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryReservations_OutboundOrderItems_OrderItemId_OrderId_IsDirectPick",
                table: "InventoryReservations",
                columns: new[] { "OrderItemId", "OrderId", "IsDirectPick" },
                principalTable: "OutboundOrderItems",
                principalColumns: new[] { "Id", "OrderId", "IsDirectPick" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryReservations_OutboundAllocations_AllocationId_OrderId_IsDirectPick",
                table: "InventoryReservations");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryReservations_OutboundOrderItems_OrderItemId_OrderId_IsDirectPick",
                table: "InventoryReservations");

            migrationBuilder.DropColumn(name: "SourceLotNumber", table: "InventoryReservations");
            migrationBuilder.DropColumn(name: "SourceExpirationDate", table: "InventoryReservations");
            migrationBuilder.DropUniqueConstraint(
                name: "AK_OutboundOrderItems_Id_OrderId_IsDirectPick",
                table: "OutboundOrderItems");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OutboundOrderItems_Progress",
                table: "OutboundOrderItems");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_OutboundAllocations_Id_OrderId_IsDirectPick",
                table: "OutboundAllocations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OutboundAllocations_Bins",
                table: "OutboundAllocations");

            migrationBuilder.DropIndex(
                name: "IX_InventoryReservations_AllocationId_OrderId_IsDirectPick",
                table: "InventoryReservations");

            migrationBuilder.DropIndex(
                name: "IX_InventoryReservations_OrderItemId_OrderId_IsDirectPick",
                table: "InventoryReservations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_InventoryReservations_Staging",
                table: "InventoryReservations");

            migrationBuilder.DropColumn(
                name: "IsDirectPick",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "IsDirectPick",
                table: "OutboundAllocations");

            migrationBuilder.DropColumn(
                name: "IsDirectPick",
                table: "InventoryReservations");

            migrationBuilder.AlterColumn<Guid>(
                name: "StagingBinId",
                table: "OutboundAllocations",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_OutboundOrderItems_Progress",
                table: "OutboundOrderItems",
                sql: "[ReservedQuantity] >= 0 AND [ShippedQuantity] >= 0 AND [ShippedQuantity] <= [StagedQuantity] AND [StagedQuantity] <= [PickedQuantity] AND [PickedQuantity] <= [Quantity] AND [ReservedQuantity] <= [Quantity] - [ShippedQuantity]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_OutboundAllocations_Bins",
                table: "OutboundAllocations",
                sql: "[SourceBinId] <> [StagingBinId]");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_AllocationId_OrderId",
                table: "InventoryReservations",
                columns: new[] { "AllocationId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_OrderItemId_OrderId",
                table: "InventoryReservations",
                columns: new[] { "OrderItemId", "OrderId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_InventoryReservations_Staging",
                table: "InventoryReservations",
                sql: "([StagingBinInventoryId] IS NULL OR [StagingBinInventoryId] <> [SourceBinInventoryId]) AND ([PickedQuantity] = 0 OR [StagingBinInventoryId] IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryReservations_OutboundAllocations_AllocationId_OrderId",
                table: "InventoryReservations",
                columns: new[] { "AllocationId", "OrderId" },
                principalTable: "OutboundAllocations",
                principalColumns: new[] { "Id", "OrderId" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryReservations_OutboundOrderItems_OrderItemId_OrderId",
                table: "InventoryReservations",
                columns: new[] { "OrderItemId", "OrderId" },
                principalTable: "OutboundOrderItems",
                principalColumns: new[] { "Id", "OrderId" },
                onDelete: ReferentialAction.Restrict);
        }
    }
}
