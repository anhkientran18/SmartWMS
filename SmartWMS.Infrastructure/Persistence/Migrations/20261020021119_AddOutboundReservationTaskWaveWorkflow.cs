using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOutboundReservationTaskWaveWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Read-only preflight before any DDL; never repair parent IDs or legacy workflow data.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [OutboundOrderItems] AS i
                    WHERE i.[OutboundIssueId] IS NULL
                        OR i.[OrderId] = CAST('00000000-0000-0000-0000-000000000000' AS uniqueidentifier)
                        OR i.[OrderId] <> i.[OutboundIssueId]
                        OR NOT EXISTS (SELECT 1 FROM [OutboundIssues] AS o WHERE o.[Id] = i.[OrderId])
                        OR NOT EXISTS (SELECT 1 FROM [OutboundIssues] AS o WHERE o.[Id] = i.[OutboundIssueId]))
                    THROW 51104, 'Order item parent baseline is unsafe. No reconciliation is performed.', 1;
                IF EXISTS (SELECT 1 FROM [ProductSerialNumbers]
                    WHERE DATALENGTH([SerialCode]) = 0 OR DATALENGTH([SerialCode]) > 100
                        OR UNICODE(LEFT([SerialCode], 1)) IN (9,10,11,12,13,32,133,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288)
                        OR UNICODE(RIGHT([SerialCode], 1)) IN (9,10,11,12,13,32,133,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288))
                    THROW 51100, 'Serial length/whitespace is unsafe. Review data; migration performs no cleanup.', 1;

                IF EXISTS (SELECT 1 FROM [ProductSerialNumbers]
                    GROUP BY [ProductId], [SerialCode] COLLATE Latin1_General_100_BIN2 HAVING COUNT_BIG(*) > 1)
                    THROW 51101, 'Duplicate product/serial identity. Review data before applying; no normalization is performed.', 1;

                IF EXISTS (SELECT 1 FROM [ProductSerialNumbers]
                    WHERE [Status] NOT IN (N'InStock', N'Damaged', N'Blocked', N'Quarantined'))
                    OR EXISTS (SELECT 1 FROM [OutboundIssues] WHERE [Status] IN (N'Picking', N'Picked', N'Staged', N'Shipped'))
                    OR EXISTS (SELECT 1 FROM [OutboundOrderItems] WHERE [Status] IN (N'Picking', N'Picked', N'Staged', N'Shipped'))
                    THROW 51102, 'Legacy serial/picking/shipping requires explicit review. No reconciliation is performed.', 1;

                IF EXISTS (SELECT 1 FROM [BinInventories] WHERE [Quantity] < 0 OR [ReservedQuantity] < 0 OR [ReservedQuantity] > [Quantity])
                    OR EXISTS (SELECT 1 FROM [Bins] WHERE [MaxCapacity] < 0 OR [CurrentOccupancy] < 0 OR [CurrentOccupancy] > [MaxCapacity])
                    THROW 51103, 'Inventory/reservation/capacity baseline is unsafe. No business data is modified.', 1;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_Products_ProductId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_OutboundOrderItems_OutboundIssues_OutboundIssueId",
                table: "OutboundOrderItems");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductSerialNumbers_Products_ProductId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropIndex(
                name: "IX_ProductSerialNumbers_ProductId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropIndex(
                name: "IX_OutboundOrderItems_OutboundIssueId",
                table: "OutboundOrderItems");

            migrationBuilder.DropColumn(
                name: "OutboundIssueId",
                table: "OutboundOrderItems");

            migrationBuilder.AlterColumn<string>(
                name: "SerialCode",
                table: "ProductSerialNumbers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                collation: "Latin1_General_100_BIN2",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<Guid>(
                name: "InboundReceiptItemId",
                table: "ProductSerialNumbers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReceivedAt",
                table: "ProductSerialNumbers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReservationId",
                table: "ProductSerialNumbers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "ProductSerialNumbers",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<Guid>(
                name: "ShipmentItemId",
                table: "ProductSerialNumbers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BinInventoryId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DestinationBinInventoryId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FulfilmentOperationRequestId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "InventoryReservationId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OutboundOrderItemId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OutboundPickRequestId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PickTaskId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ShipmentId",
                table: "InventoryTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddUniqueConstraint(
                name: "AK_OutboundOrderItems_Id_OrderId",
                table: "OutboundOrderItems",
                columns: new[] { "Id", "OrderId" });

            migrationBuilder.CreateTable(
                name: "OutboundAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Generation = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    SourceBinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StagingBinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboundAllocations", x => x.Id);
                    table.UniqueConstraint("AK_OutboundAllocations_Id_OrderId", x => new { x.Id, x.OrderId });
                    table.CheckConstraint("CK_OutboundAllocations_Bins", "[SourceBinId] <> [StagingBinId]");
                    table.CheckConstraint("CK_OutboundAllocations_Generation", "[Generation] > 0");
                    table.CheckConstraint("CK_OutboundAllocations_State", "([IsActive] = 1 AND [Status] IN (N'Active', N'Picking', N'Picked', N'Staged')) OR ([IsActive] = 0 AND [Status] IN (N'Released', N'Shipped'))");
                    table.ForeignKey(
                        name: "FK_OutboundAllocations_Bins_SourceBinId",
                        column: x => x.SourceBinId,
                        principalTable: "Bins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutboundAllocations_Bins_StagingBinId",
                        column: x => x.StagingBinId,
                        principalTable: "Bins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutboundAllocations_OutboundIssues_OrderId",
                        column: x => x.OrderId,
                        principalTable: "OutboundIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Waves",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WaveCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CanonicalTaskSet = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TaskSetHash = table.Column<string>(type: "varchar(64)", nullable: false, collation: "Latin1_General_100_BIN2"),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Waves", x => x.Id);
                    table.CheckConstraint("CK_Waves_Identity", "LEN(LTRIM(RTRIM([WaveCode]))) > 0 AND LEN([CanonicalTaskSet]) > 0 AND DATALENGTH([TaskSetHash]) = 64 AND [TaskSetHash] NOT LIKE '%[^0-9a-f]%'");
                    table.CheckConstraint("CK_Waves_Status", "[Status] IN (N'Created', N'InProgress', N'Picked', N'Staged', N'Completed', N'Cancelled')");
                    table.ForeignKey(
                        name: "FK_Waves_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InventoryReservations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AllocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceBinInventoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StagingBinInventoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    PickedQuantity = table.Column<int>(type: "int", nullable: false),
                    ShippedQuantity = table.Column<int>(type: "int", nullable: false),
                    ReleasedQuantity = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryReservations", x => x.Id);
                    table.UniqueConstraint("AK_InventoryReservations_Id_AllocationId", x => new { x.Id, x.AllocationId });
                    table.UniqueConstraint("AK_InventoryReservations_Id_AllocationId_OrderId_OrderItemId", x => new { x.Id, x.AllocationId, x.OrderId, x.OrderItemId });
                    table.CheckConstraint("CK_InventoryReservations_Progress", "[Quantity] > 0 AND [PickedQuantity] >= 0 AND [ReleasedQuantity] >= 0 AND CAST([PickedQuantity] AS bigint) + [ReleasedQuantity] <= [Quantity] AND [ShippedQuantity] >= 0 AND [ShippedQuantity] <= [PickedQuantity]");
                    table.CheckConstraint("CK_InventoryReservations_Staging", "([StagingBinInventoryId] IS NULL OR [StagingBinInventoryId] <> [SourceBinInventoryId]) AND ([PickedQuantity] = 0 OR [StagingBinInventoryId] IS NOT NULL)");
                    table.CheckConstraint("CK_InventoryReservations_Status", "[Status] IN (N'Active', N'PartiallyPicked', N'Picked', N'Shipped', N'Released')");
                    table.ForeignKey(
                        name: "FK_InventoryReservations_BinInventories_SourceBinInventoryId",
                        column: x => x.SourceBinInventoryId,
                        principalTable: "BinInventories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryReservations_BinInventories_StagingBinInventoryId",
                        column: x => x.StagingBinInventoryId,
                        principalTable: "BinInventories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryReservations_OutboundAllocations_AllocationId_OrderId",
                        columns: x => new { x.AllocationId, x.OrderId },
                        principalTable: "OutboundAllocations",
                        principalColumns: new[] { "Id", "OrderId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryReservations_OutboundOrderItems_OrderItemId_OrderId",
                        columns: x => new { x.OrderItemId, x.OrderId },
                        principalTable: "OutboundOrderItems",
                        principalColumns: new[] { "Id", "OrderId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OutboundPickRequests",
                columns: table => new
                {
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AllocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StagingBinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LotNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TrackingMode = table.Column<int>(type: "int", nullable: false),
                    QuantityPicked = table.Column<int>(type: "int", nullable: false),
                    NaturalPickKey = table.Column<string>(type: "varchar(64)", nullable: true, collation: "Latin1_General_100_BIN2"),
                    CanonicalPayload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PayloadHash = table.Column<string>(type: "varchar(64)", nullable: false, collation: "Latin1_General_100_BIN2"),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboundPickRequests", x => x.RequestId);
                    table.UniqueConstraint("AK_OutboundPickRequests_RequestId_AllocationId", x => new { x.RequestId, x.AllocationId });
                    table.CheckConstraint("CK_OutboundPickRequests_Payload", "[QuantityPicked] > 0 AND [TrackingMode] IN (0, 1, 2) AND [BinId] <> [StagingBinId] AND ([TrackingMode] <> 1 OR LEN(LTRIM(RTRIM([LotNumber]))) > 0 AND [LotNumber] IS NOT NULL) AND ([TrackingMode] = 2 OR [OrderItemId] IS NOT NULL)");
                    table.CheckConstraint("CK_OutboundPickRequests_Result", "[Status] = N'Completed' AND LEN([CanonicalPayload]) > 0 AND DATALENGTH([PayloadHash]) = 64 AND [PayloadHash] NOT LIKE '%[^0-9a-f]%' AND ([NaturalPickKey] IS NULL OR DATALENGTH([NaturalPickKey]) = 64 AND [NaturalPickKey] NOT LIKE '%[^0-9a-f]%')");
                    table.ForeignKey(
                        name: "FK_OutboundPickRequests_Bins_BinId",
                        column: x => x.BinId,
                        principalTable: "Bins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutboundPickRequests_Bins_StagingBinId",
                        column: x => x.StagingBinId,
                        principalTable: "Bins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutboundPickRequests_OutboundAllocations_AllocationId_OrderId",
                        columns: x => new { x.AllocationId, x.OrderId },
                        principalTable: "OutboundAllocations",
                        principalColumns: new[] { "Id", "OrderId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutboundPickRequests_OutboundOrderItems_OrderItemId_OrderId",
                        columns: x => new { x.OrderItemId, x.OrderId },
                        principalTable: "OutboundOrderItems",
                        principalColumns: new[] { "Id", "OrderId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutboundPickRequests_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Shipments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AllocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StagingBinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CanonicalPackingPayload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ShippedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shipments", x => x.Id);
                    table.UniqueConstraint("AK_Shipments_Id_AllocationId_OrderId", x => new { x.Id, x.AllocationId, x.OrderId });
                    table.CheckConstraint("CK_Shipments_Packing", "LEN([CanonicalPackingPayload]) > 0");
                    table.ForeignKey(
                        name: "FK_Shipments_Bins_StagingBinId",
                        column: x => x.StagingBinId,
                        principalTable: "Bins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Shipments_OutboundAllocations_AllocationId_OrderId",
                        columns: x => new { x.AllocationId, x.OrderId },
                        principalTable: "OutboundAllocations",
                        principalColumns: new[] { "Id", "OrderId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Shipments_OutboundIssues_OrderId",
                        column: x => x.OrderId,
                        principalTable: "OutboundIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PickTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AllocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReservationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceBinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StagingBinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    PickedQuantity = table.Column<int>(type: "int", nullable: false),
                    StagedQuantity = table.Column<int>(type: "int", nullable: false),
                    AssignedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PickTasks", x => x.Id);
                    table.UniqueConstraint("AK_PickTasks_Id_AllocationId", x => new { x.Id, x.AllocationId });
                    table.CheckConstraint("CK_PickTasks_Bins", "[SourceBinId] <> [StagingBinId]");
                    table.CheckConstraint("CK_PickTasks_Progress", "[Quantity] > 0 AND [StagedQuantity] >= 0 AND [StagedQuantity] <= [PickedQuantity] AND [PickedQuantity] <= [Quantity]");
                    table.CheckConstraint("CK_PickTasks_Status", "[Status] IN (N'Ready', N'Waved', N'Picking', N'Picked', N'Staged', N'Completed', N'Released')");
                    table.ForeignKey(
                        name: "FK_PickTasks_Bins_SourceBinId",
                        column: x => x.SourceBinId,
                        principalTable: "Bins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PickTasks_Bins_StagingBinId",
                        column: x => x.StagingBinId,
                        principalTable: "Bins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PickTasks_InventoryReservations_ReservationId_AllocationId",
                        columns: x => new { x.ReservationId, x.AllocationId },
                        principalTable: "InventoryReservations",
                        principalColumns: new[] { "Id", "AllocationId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PickTasks_Users_AssignedUserId",
                        column: x => x.AssignedUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FulfilmentOperationRequests",
                columns: table => new
                {
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OperationKind = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ScopeKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false, collation: "Latin1_General_100_BIN2"),
                    NaturalOperationKey = table.Column<string>(type: "varchar(64)", nullable: true, collation: "Latin1_General_100_BIN2"),
                    CanonicalPayload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PayloadHash = table.Column<string>(type: "varchar(64)", nullable: false, collation: "Latin1_General_100_BIN2"),
                    CompletedResponseJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    AllocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    InboundReceiptId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    WaveId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FulfilmentOperationRequests", x => x.RequestId);
                    table.CheckConstraint("CK_FulfilmentOperationRequests_Operation", "[OperationKind] IN (N'ReceiveInbound', N'Allocate', N'CreateWave', N'ConfirmStaging', N'ReleaseAllocation', N'Ship')");
                    table.CheckConstraint("CK_FulfilmentOperationRequests_Result", "[Status] = N'Completed' AND LEN([CanonicalPayload]) > 0 AND LEN([CompletedResponseJson]) > 0 AND DATALENGTH([PayloadHash]) = 64 AND [PayloadHash] NOT LIKE '%[^0-9a-f]%' AND ([NaturalOperationKey] IS NULL OR DATALENGTH([NaturalOperationKey]) = 64 AND [NaturalOperationKey] NOT LIKE '%[^0-9a-f]%')");
                    table.CheckConstraint("CK_FulfilmentOperationRequests_Scope", "([OperationKind] = N'ReceiveInbound' AND [InboundReceiptId] IS NOT NULL AND [AllocationId] IS NULL AND [ScopeKey] = N'inbound:' + LOWER(CONVERT(nvarchar(36), [InboundReceiptId]))) OR ([OperationKind] = N'CreateWave' AND [WaveId] IS NOT NULL AND [AllocationId] IS NULL AND [ScopeKey] LIKE N'wave:%' AND LEN([ScopeKey]) = 69) OR ([OperationKind] IN (N'Allocate', N'ConfirmStaging', N'ReleaseAllocation', N'Ship') AND [AllocationId] IS NOT NULL AND [OrderId] IS NOT NULL AND [ScopeKey] = N'allocation:' + LOWER(CONVERT(nvarchar(36), [AllocationId])) AND ([OperationKind] <> N'Ship' OR [ShipmentId] IS NOT NULL))");
                    table.ForeignKey(
                        name: "FK_FulfilmentOperationRequests_InboundReceipts_InboundReceiptId",
                        column: x => x.InboundReceiptId,
                        principalTable: "InboundReceipts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FulfilmentOperationRequests_OutboundAllocations_AllocationId_OrderId",
                        columns: x => new { x.AllocationId, x.OrderId },
                        principalTable: "OutboundAllocations",
                        principalColumns: new[] { "Id", "OrderId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FulfilmentOperationRequests_OutboundIssues_OrderId",
                        column: x => x.OrderId,
                        principalTable: "OutboundIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FulfilmentOperationRequests_Shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalTable: "Shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FulfilmentOperationRequests_Waves_WaveId",
                        column: x => x.WaveId,
                        principalTable: "Waves",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShipmentItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AllocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReservationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BinInventoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShipmentItems", x => x.Id);
                    table.CheckConstraint("CK_ShipmentItems_Quantity", "[Quantity] > 0");
                    table.ForeignKey(
                        name: "FK_ShipmentItems_BinInventories_BinInventoryId",
                        column: x => x.BinInventoryId,
                        principalTable: "BinInventories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShipmentItems_InventoryReservations_ReservationId_AllocationId_OrderId_OrderItemId",
                        columns: x => new { x.ReservationId, x.AllocationId, x.OrderId, x.OrderItemId },
                        principalTable: "InventoryReservations",
                        principalColumns: new[] { "Id", "AllocationId", "OrderId", "OrderItemId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShipmentItems_Shipments_ShipmentId_AllocationId_OrderId",
                        columns: x => new { x.ShipmentId, x.AllocationId, x.OrderId },
                        principalTable: "Shipments",
                        principalColumns: new[] { "Id", "AllocationId", "OrderId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OutboundPickRequestItems",
                columns: table => new
                {
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PickTaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AllocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuantityPicked = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboundPickRequestItems", x => new { x.RequestId, x.PickTaskId });
                    table.CheckConstraint("CK_OutboundPickRequestItems_Quantity", "[QuantityPicked] > 0");
                    table.ForeignKey(
                        name: "FK_OutboundPickRequestItems_OutboundPickRequests_RequestId_AllocationId",
                        columns: x => new { x.RequestId, x.AllocationId },
                        principalTable: "OutboundPickRequests",
                        principalColumns: new[] { "RequestId", "AllocationId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutboundPickRequestItems_PickTasks_PickTaskId_AllocationId",
                        columns: x => new { x.PickTaskId, x.AllocationId },
                        principalTable: "PickTasks",
                        principalColumns: new[] { "Id", "AllocationId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WavePickTasks",
                columns: table => new
                {
                    WaveId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PickTaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RemovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WavePickTasks", x => new { x.WaveId, x.PickTaskId });
                    table.CheckConstraint("CK_WavePickTasks_Membership", "([IsActive] = 1 AND [RemovedAt] IS NULL) OR ([IsActive] = 0 AND [RemovedAt] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_WavePickTasks_PickTasks_PickTaskId",
                        column: x => x.PickTaskId,
                        principalTable: "PickTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WavePickTasks_Waves_WaveId",
                        column: x => x.WaveId,
                        principalTable: "Waves",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductSerialNumbers_BinInventoryId",
                table: "ProductSerialNumbers",
                column: "BinInventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductSerialNumbers_InboundReceiptItemId",
                table: "ProductSerialNumbers",
                column: "InboundReceiptItemId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductSerialNumbers_ProductId_SerialCode",
                table: "ProductSerialNumbers",
                columns: new[] { "ProductId", "SerialCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductSerialNumbers_ReservationId",
                table: "ProductSerialNumbers",
                column: "ReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductSerialNumbers_ShipmentItemId",
                table: "ProductSerialNumbers",
                column: "ShipmentItemId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ProductSerialNumbers_SerialCode",
                table: "ProductSerialNumbers",
                sql: "DATALENGTH([SerialCode]) > 0 AND UNICODE(LEFT([SerialCode], 1)) NOT IN (9,10,11,12,13,32,133,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288) AND UNICODE(RIGHT([SerialCode], 1)) NOT IN (9,10,11,12,13,32,133,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288)");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundOrderItems_OrderId",
                table: "OutboundOrderItems",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_BinInventoryId",
                table: "InventoryTransactions",
                column: "BinInventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_DestinationBinInventoryId",
                table: "InventoryTransactions",
                column: "DestinationBinInventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_FulfilmentOperationRequestId",
                table: "InventoryTransactions",
                column: "FulfilmentOperationRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_InventoryReservationId",
                table: "InventoryTransactions",
                column: "InventoryReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_OutboundOrderItemId",
                table: "InventoryTransactions",
                column: "OutboundOrderItemId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_PickTaskId",
                table: "InventoryTransactions",
                column: "PickTaskId");

            migrationBuilder.CreateIndex(
                name: "UX_InventoryTransactions_PickMovement",
                table: "InventoryTransactions",
                columns: new[] { "OutboundPickRequestId", "PickTaskId" },
                unique: true,
                filter: "[OutboundPickRequestId] IS NOT NULL AND [PickTaskId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_InventoryTransactions_ShipmentMovement",
                table: "InventoryTransactions",
                columns: new[] { "ShipmentId", "InventoryReservationId" },
                unique: true,
                filter: "[ShipmentId] IS NOT NULL AND [InventoryReservationId] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_InventoryTransactions_PickTrace",
                table: "InventoryTransactions",
                sql: "[OutboundPickRequestId] IS NULL OR ([PickTaskId] IS NOT NULL AND [InventoryReservationId] IS NOT NULL AND [OutboundOrderItemId] IS NOT NULL AND [BinInventoryId] IS NOT NULL AND [DestinationBinInventoryId] IS NOT NULL AND [BinInventoryId] <> [DestinationBinInventoryId] AND [ShipmentId] IS NULL AND [QuantityChanged] <> 0)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_InventoryTransactions_ShipmentTrace",
                table: "InventoryTransactions",
                sql: "[ShipmentId] IS NULL OR ([InventoryReservationId] IS NOT NULL AND [OutboundOrderItemId] IS NOT NULL AND [BinInventoryId] IS NOT NULL AND [OutboundPickRequestId] IS NULL AND [QuantityChanged] <> 0)");

            migrationBuilder.CreateIndex(
                name: "IX_FulfilmentOperationRequests_AllocationId_OrderId",
                table: "FulfilmentOperationRequests",
                columns: new[] { "AllocationId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_FulfilmentOperationRequests_InboundReceiptId",
                table: "FulfilmentOperationRequests",
                column: "InboundReceiptId");

            migrationBuilder.CreateIndex(
                name: "IX_FulfilmentOperationRequests_OperationKind_ScopeKey_NaturalOperationKey",
                table: "FulfilmentOperationRequests",
                columns: new[] { "OperationKind", "ScopeKey", "NaturalOperationKey" },
                unique: true,
                filter: "[NaturalOperationKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_FulfilmentOperationRequests_OrderId",
                table: "FulfilmentOperationRequests",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_FulfilmentOperationRequests_ShipmentId",
                table: "FulfilmentOperationRequests",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_FulfilmentOperationRequests_WaveId",
                table: "FulfilmentOperationRequests",
                column: "WaveId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_AllocationId_OrderId",
                table: "InventoryReservations",
                columns: new[] { "AllocationId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_AllocationId_OrderItemId_SourceBinInventoryId",
                table: "InventoryReservations",
                columns: new[] { "AllocationId", "OrderItemId", "SourceBinInventoryId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_OrderItemId_OrderId",
                table: "InventoryReservations",
                columns: new[] { "OrderItemId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_SourceBinInventoryId",
                table: "InventoryReservations",
                column: "SourceBinInventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryReservations_StagingBinInventoryId",
                table: "InventoryReservations",
                column: "StagingBinInventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundAllocations_OrderId_Generation",
                table: "OutboundAllocations",
                columns: new[] { "OrderId", "Generation" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OutboundAllocations_SourceBinId",
                table: "OutboundAllocations",
                column: "SourceBinId");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundAllocations_StagingBinId",
                table: "OutboundAllocations",
                column: "StagingBinId");

            migrationBuilder.CreateIndex(
                name: "UX_OutboundAllocations_ActiveOrder",
                table: "OutboundAllocations",
                column: "OrderId",
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequestItems_PickTaskId_AllocationId",
                table: "OutboundPickRequestItems",
                columns: new[] { "PickTaskId", "AllocationId" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequestItems_RequestId_AllocationId",
                table: "OutboundPickRequestItems",
                columns: new[] { "RequestId", "AllocationId" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequests_AllocationId_NaturalPickKey",
                table: "OutboundPickRequests",
                columns: new[] { "AllocationId", "NaturalPickKey" },
                unique: true,
                filter: "[NaturalPickKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequests_AllocationId_OrderId",
                table: "OutboundPickRequests",
                columns: new[] { "AllocationId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequests_BinId",
                table: "OutboundPickRequests",
                column: "BinId");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequests_OrderItemId_OrderId",
                table: "OutboundPickRequests",
                columns: new[] { "OrderItemId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequests_ProductId",
                table: "OutboundPickRequests",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundPickRequests_StagingBinId",
                table: "OutboundPickRequests",
                column: "StagingBinId");

            migrationBuilder.CreateIndex(
                name: "IX_PickTasks_AssignedUserId",
                table: "PickTasks",
                column: "AssignedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PickTasks_ReservationId",
                table: "PickTasks",
                column: "ReservationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PickTasks_ReservationId_AllocationId",
                table: "PickTasks",
                columns: new[] { "ReservationId", "AllocationId" });

            migrationBuilder.CreateIndex(
                name: "IX_PickTasks_SourceBinId",
                table: "PickTasks",
                column: "SourceBinId");

            migrationBuilder.CreateIndex(
                name: "IX_PickTasks_StagingBinId",
                table: "PickTasks",
                column: "StagingBinId");

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentItems_BinInventoryId",
                table: "ShipmentItems",
                column: "BinInventoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentItems_ReservationId_AllocationId_OrderId_OrderItemId",
                table: "ShipmentItems",
                columns: new[] { "ReservationId", "AllocationId", "OrderId", "OrderItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentItems_ShipmentId_AllocationId_OrderId",
                table: "ShipmentItems",
                columns: new[] { "ShipmentId", "AllocationId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentItems_ShipmentId_ReservationId",
                table: "ShipmentItems",
                columns: new[] { "ShipmentId", "ReservationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_AllocationId_OrderId",
                table: "Shipments",
                columns: new[] { "AllocationId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_StagingBinId",
                table: "Shipments",
                column: "StagingBinId");

            migrationBuilder.CreateIndex(
                name: "UX_Shipments_OrderId_WholeOrderV1",
                table: "Shipments",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_WavePickTasks_ActiveTask",
                table: "WavePickTasks",
                column: "PickTaskId",
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_Waves_TaskSetHash",
                table: "Waves",
                column: "TaskSetHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Waves_WarehouseId",
                table: "Waves",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_Waves_WaveCode",
                table: "Waves",
                column: "WaveCode",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_BinInventories_BinInventoryId",
                table: "InventoryTransactions",
                column: "BinInventoryId",
                principalTable: "BinInventories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_BinInventories_DestinationBinInventoryId",
                table: "InventoryTransactions",
                column: "DestinationBinInventoryId",
                principalTable: "BinInventories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_FulfilmentOperationRequests_FulfilmentOperationRequestId",
                table: "InventoryTransactions",
                column: "FulfilmentOperationRequestId",
                principalTable: "FulfilmentOperationRequests",
                principalColumn: "RequestId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_InventoryReservations_InventoryReservationId",
                table: "InventoryTransactions",
                column: "InventoryReservationId",
                principalTable: "InventoryReservations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_OutboundOrderItems_OutboundOrderItemId",
                table: "InventoryTransactions",
                column: "OutboundOrderItemId",
                principalTable: "OutboundOrderItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_OutboundPickRequests_OutboundPickRequestId",
                table: "InventoryTransactions",
                column: "OutboundPickRequestId",
                principalTable: "OutboundPickRequests",
                principalColumn: "RequestId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_PickTasks_PickTaskId",
                table: "InventoryTransactions",
                column: "PickTaskId",
                principalTable: "PickTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_Products_ProductId",
                table: "InventoryTransactions",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_Shipments_ShipmentId",
                table: "InventoryTransactions",
                column: "ShipmentId",
                principalTable: "Shipments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OutboundOrderItems_OutboundIssues_OrderId",
                table: "OutboundOrderItems",
                column: "OrderId",
                principalTable: "OutboundIssues",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductSerialNumbers_BinInventories_BinInventoryId",
                table: "ProductSerialNumbers",
                column: "BinInventoryId",
                principalTable: "BinInventories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductSerialNumbers_InboundReceiptItems_InboundReceiptItemId",
                table: "ProductSerialNumbers",
                column: "InboundReceiptItemId",
                principalTable: "InboundReceiptItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductSerialNumbers_InventoryReservations_ReservationId",
                table: "ProductSerialNumbers",
                column: "ReservationId",
                principalTable: "InventoryReservations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductSerialNumbers_Products_ProductId",
                table: "ProductSerialNumbers",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductSerialNumbers_ShipmentItems_ShipmentItemId",
                table: "ProductSerialNumbers",
                column: "ShipmentItemId",
                principalTable: "ShipmentItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_BinInventories_BinInventoryId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_BinInventories_DestinationBinInventoryId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_FulfilmentOperationRequests_FulfilmentOperationRequestId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_InventoryReservations_InventoryReservationId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_OutboundOrderItems_OutboundOrderItemId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_OutboundPickRequests_OutboundPickRequestId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_PickTasks_PickTaskId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_Products_ProductId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_Shipments_ShipmentId",
                table: "InventoryTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_OutboundOrderItems_OutboundIssues_OrderId",
                table: "OutboundOrderItems");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductSerialNumbers_BinInventories_BinInventoryId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductSerialNumbers_InboundReceiptItems_InboundReceiptItemId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductSerialNumbers_InventoryReservations_ReservationId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductSerialNumbers_Products_ProductId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductSerialNumbers_ShipmentItems_ShipmentItemId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropTable(
                name: "FulfilmentOperationRequests");

            migrationBuilder.DropTable(
                name: "OutboundPickRequestItems");

            migrationBuilder.DropTable(
                name: "ShipmentItems");

            migrationBuilder.DropTable(
                name: "WavePickTasks");

            migrationBuilder.DropTable(
                name: "OutboundPickRequests");

            migrationBuilder.DropTable(
                name: "Shipments");

            migrationBuilder.DropTable(
                name: "PickTasks");

            migrationBuilder.DropTable(
                name: "Waves");

            migrationBuilder.DropTable(
                name: "InventoryReservations");

            migrationBuilder.DropTable(
                name: "OutboundAllocations");

            migrationBuilder.DropIndex(
                name: "IX_ProductSerialNumbers_BinInventoryId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropIndex(
                name: "IX_ProductSerialNumbers_InboundReceiptItemId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropIndex(
                name: "IX_ProductSerialNumbers_ProductId_SerialCode",
                table: "ProductSerialNumbers");

            migrationBuilder.DropIndex(
                name: "IX_ProductSerialNumbers_ReservationId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropIndex(
                name: "IX_ProductSerialNumbers_ShipmentItemId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ProductSerialNumbers_SerialCode",
                table: "ProductSerialNumbers");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_OutboundOrderItems_Id_OrderId",
                table: "OutboundOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_OutboundOrderItems_OrderId",
                table: "OutboundOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_BinInventoryId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_DestinationBinInventoryId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_FulfilmentOperationRequestId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_InventoryReservationId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_OutboundOrderItemId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_PickTaskId",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "UX_InventoryTransactions_PickMovement",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "UX_InventoryTransactions_ShipmentMovement",
                table: "InventoryTransactions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_InventoryTransactions_PickTrace",
                table: "InventoryTransactions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_InventoryTransactions_ShipmentTrace",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "InboundReceiptItemId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropColumn(
                name: "ReceivedAt",
                table: "ProductSerialNumbers");

            migrationBuilder.DropColumn(
                name: "ReservationId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "ProductSerialNumbers");

            migrationBuilder.DropColumn(
                name: "ShipmentItemId",
                table: "ProductSerialNumbers");

            migrationBuilder.DropColumn(
                name: "BinInventoryId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "DestinationBinInventoryId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "FulfilmentOperationRequestId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "InventoryReservationId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "OutboundOrderItemId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "OutboundPickRequestId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "PickTaskId",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "ShipmentId",
                table: "InventoryTransactions");

            migrationBuilder.AlterColumn<string>(
                name: "SerialCode",
                table: "ProductSerialNumbers",
                type: "nvarchar(max)",
                nullable: false,
                collation: "DATABASE_DEFAULT",
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldCollation: "Latin1_General_100_BIN2");

            migrationBuilder.AddColumn<Guid>(
                name: "OutboundIssueId",
                table: "OutboundOrderItems",
                type: "uniqueidentifier",
                nullable: true);
            // Restore the old collection relationship before rebuilding its index/FK.
            migrationBuilder.Sql("""
                UPDATE [OutboundOrderItems]
                SET [OutboundIssueId] = [OrderId];
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ProductSerialNumbers_ProductId",
                table: "ProductSerialNumbers",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OutboundOrderItems_OutboundIssueId",
                table: "OutboundOrderItems",
                column: "OutboundIssueId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_Products_ProductId",
                table: "InventoryTransactions",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OutboundOrderItems_OutboundIssues_OutboundIssueId",
                table: "OutboundOrderItems",
                column: "OutboundIssueId",
                principalTable: "OutboundIssues",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductSerialNumbers_Products_ProductId",
                table: "ProductSerialNumbers",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
