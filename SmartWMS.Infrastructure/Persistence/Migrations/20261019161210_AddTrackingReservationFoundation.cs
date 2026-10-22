using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackingReservationFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing data keeps the approved four-product backfill and every fail-closed guard.
            // A new inventory-empty database needs only the schema: do not fabricate demo stock.
            migrationBuilder.Sql("""
                DECLARE @InventoryEmpty bit = CASE WHEN
                    NOT EXISTS (SELECT 1 FROM [Products])
                    AND NOT EXISTS (SELECT 1 FROM [BinInventories])
                    AND NOT EXISTS (SELECT 1 FROM [ProductSerialNumbers])
                    AND NOT EXISTS (SELECT 1 FROM [InboundReceipts])
                    AND NOT EXISTS (SELECT 1 FROM [InboundReceiptItems])
                    AND NOT EXISTS (SELECT 1 FROM [OutboundIssues])
                    AND NOT EXISTS (SELECT 1 FROM [OutboundOrderItems])
                    AND NOT EXISTS (SELECT 1 FROM [InventoryTransactions])
                    AND NOT EXISTS (SELECT 1 FROM [CycleCountSheets])
                    AND NOT EXISTS (SELECT 1 FROM [CycleCountItems])
                    AND NOT EXISTS (SELECT 1 FROM [Bins] WHERE [CurrentOccupancy] <> 0)
                    THEN 1 ELSE 0 END;

                IF @InventoryEmpty = 0 AND ((SELECT COUNT_BIG(*) FROM [Products]) <> 4
                    OR EXISTS (
                        SELECT v.[Id], v.[SKU]
                        FROM (VALUES
                            (CAST('601f864f-5e9a-4021-8a4b-8c7aad9a1ef1' AS uniqueidentifier), N'ASUS-ROGSTRIX-G16'),
                            (CAST('e511b03f-6825-4a60-9a24-55b8c9ca189e' AS uniqueidentifier), N'COCA-COOL-320'),
                            (CAST('be01ea85-9d57-4aea-8272-517dfa1cff5d' AS uniqueidentifier), N'LOGI-MOUSE-MX3'),
                            (CAST('bf2ed393-73c1-4bf9-9322-c6c39c49ff47' AS uniqueidentifier), N'MILK-VINAMILK-1L')
                        ) AS v([Id], [SKU])
                        EXCEPT SELECT [Id], [SKU] FROM [Products]
                    ))
                    THROW 51000, 'Product baseline changed. Review the approved tracking backfill before applying.', 1;

                IF @InventoryEmpty = 0 AND (EXISTS (SELECT 1 FROM [ProductSerialNumbers])
                    OR EXISTS (SELECT 1 FROM [BinInventories]
                        WHERE [ProductId] <> 'e511b03f-6825-4a60-9a24-55b8c9ca189e')
                    OR NOT EXISTS (SELECT 1 FROM [BinInventories]
                        WHERE [ProductId] = 'e511b03f-6825-4a60-9a24-55b8c9ca189e'
                            AND NULLIF(LTRIM(RTRIM([LotNumber])), N'') IS NOT NULL))
                    THROW 51001, 'Serial/inventory baseline changed. Review product tracking modes before applying.', 1;

                IF EXISTS (SELECT 1 FROM [BinInventories] WHERE [Quantity] < 0)
                    OR EXISTS (SELECT 1 FROM [Bins] WHERE [MaxCapacity] < 0
                        OR [CurrentOccupancy] < 0 OR [CurrentOccupancy] > [MaxCapacity])
                    OR EXISTS (SELECT 1 FROM [OutboundOrderItems] WHERE [Quantity] < 0)
                    THROW 51002, 'Existing quantities or occupancy violate foundation constraints. No cleanup is performed.', 1;

                IF EXISTS (SELECT 1 FROM [OutboundIssues] WHERE [Status] IN (N'Picking', N'Picked', N'Staged', N'Shipped'))
                    OR EXISTS (SELECT 1 FROM [OutboundOrderItems] WHERE [Status] IN (N'Picking', N'Picked', N'Staged', N'Shipped'))
                    THROW 51003, 'Legacy picking/shipping requires explicit reconciliation before progress columns are introduced.', 1;
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultStagingBinId",
                table: "Warehouses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TrackingMode",
                table: "Products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PickedQuantity",
                table: "OutboundOrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ReservedQuantity",
                table: "OutboundOrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "OutboundOrderItems",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "ShippedQuantity",
                table: "OutboundOrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "StagedQuantity",
                table: "OutboundOrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TrackingModeSnapshot",
                table: "OutboundOrderItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "OutboundIssues",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "InboundReceipts",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "InboundReceiptItems",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "TrackingModeSnapshot",
                table: "InboundReceiptItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Purpose",
                table: "Bins",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Bins",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "ReservedQuantity",
                table: "BinInventories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Warehouses_DefaultStagingBinId",
                table: "Warehouses",
                column: "DefaultStagingBinId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_TrackingMode",
                table: "Products",
                sql: "[TrackingMode] IN (0, 1, 2)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_OutboundOrderItems_Progress",
                table: "OutboundOrderItems",
                sql: "[ReservedQuantity] >= 0 AND [ShippedQuantity] >= 0 AND [ShippedQuantity] <= [StagedQuantity] AND [StagedQuantity] <= [PickedQuantity] AND [PickedQuantity] <= [Quantity] AND [ReservedQuantity] <= [Quantity] - [ShippedQuantity]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_OutboundOrderItems_TrackingMode",
                table: "OutboundOrderItems",
                sql: "[TrackingModeSnapshot] IS NULL OR [TrackingModeSnapshot] IN (0, 1, 2)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_InboundReceiptItems_TrackingMode",
                table: "InboundReceiptItems",
                sql: "[TrackingModeSnapshot] IS NULL OR [TrackingModeSnapshot] IN (0, 1, 2)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Bins_Occupancy",
                table: "Bins",
                sql: "[MaxCapacity] >= 0 AND [CurrentOccupancy] >= 0 AND [CurrentOccupancy] <= [MaxCapacity]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Bins_Purpose",
                table: "Bins",
                sql: "[Purpose] IN (0, 1)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_BinInventories_QuantityAndReservation",
                table: "BinInventories",
                sql: "[Quantity] >= 0 AND [ReservedQuantity] >= 0 AND [ReservedQuantity] <= [Quantity]");

            migrationBuilder.AddForeignKey(
                name: "FK_Warehouses_Bins_DefaultStagingBinId",
                table: "Warehouses",
                column: "DefaultStagingBinId",
                principalTable: "Bins",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Other approved products keep None (0), supplied by the new column default.
            // Do not backfill order/item snapshots, statuses, reservations, tasks or waves.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [Products])
                BEGIN
                    UPDATE [Products]
                    SET [TrackingMode] = 1
                    WHERE [Id] = 'e511b03f-6825-4a60-9a24-55b8c9ca189e'
                        AND [SKU] = N'COCA-COOL-320';
                    IF @@ROWCOUNT <> 1
                        THROW 51004, 'Approved COCA tracking backfill did not match exactly one product.', 1;
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Warehouses_Bins_DefaultStagingBinId",
                table: "Warehouses");

            migrationBuilder.DropIndex(
                name: "IX_Warehouses_DefaultStagingBinId",
                table: "Warehouses");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Products_TrackingMode",
                table: "Products");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OutboundOrderItems_Progress",
                table: "OutboundOrderItems");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OutboundOrderItems_TrackingMode",
                table: "OutboundOrderItems");

            migrationBuilder.DropCheckConstraint(
                name: "CK_InboundReceiptItems_TrackingMode",
                table: "InboundReceiptItems");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Bins_Occupancy",
                table: "Bins");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Bins_Purpose",
                table: "Bins");

            migrationBuilder.DropCheckConstraint(
                name: "CK_BinInventories_QuantityAndReservation",
                table: "BinInventories");

            migrationBuilder.DropColumn(
                name: "DefaultStagingBinId",
                table: "Warehouses");

            migrationBuilder.DropColumn(
                name: "TrackingMode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PickedQuantity",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "ReservedQuantity",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "ShippedQuantity",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "StagedQuantity",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "TrackingModeSnapshot",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "OutboundIssues");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "InboundReceipts");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "InboundReceiptItems");

            migrationBuilder.DropColumn(
                name: "TrackingModeSnapshot",
                table: "InboundReceiptItems");

            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "Bins");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Bins");

            migrationBuilder.DropColumn(
                name: "ReservedQuantity",
                table: "BinInventories");
        }
    }
}
