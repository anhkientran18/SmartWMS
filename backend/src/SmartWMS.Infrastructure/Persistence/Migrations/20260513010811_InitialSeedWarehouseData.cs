using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialSeedWarehouseData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SKU = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Barcode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Warehouses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Warehouses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Zones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Zones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Zones_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Bins",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ZoneId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MaxCapacity = table.Column<double>(type: "float", nullable: false),
                    CurrentOccupancy = table.Column<double>(type: "float", nullable: false, defaultValue: 0.0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bins", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Bins_Zones_ZoneId",
                        column: x => x.ZoneId,
                        principalTable: "Zones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Warehouses",
                columns: new[] { "Id", "Address", "CreatedAt", "CreatedBy", "LastModifiedAt", "LastModifiedBy", "Name" },
                values: new object[] { new Guid("7a9089f2-2b22-4211-912b-28562d2925a1"), "Khu Công Nghệ Cao, Quận 9, TP. Thủ Đức", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, "Kho Tổng Thông Minh - SmartWMS Center" });

            migrationBuilder.InsertData(
                table: "Zones",
                columns: new[] { "Id", "CreatedAt", "CreatedBy", "LastModifiedAt", "LastModifiedBy", "Name", "WarehouseId" },
                values: new object[,]
                {
                    { new Guid("e84988e0-087e-40f4-904d-771804d9c02a"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, "Khu Khô (Dry Zone)", new Guid("7a9089f2-2b22-4211-912b-28562d2925a1") },
                    { new Guid("f2e96440-1996-4e5b-9d41-3b7c0604b087"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, "Khu Mát (Cold Zone)", new Guid("7a9089f2-2b22-4211-912b-28562d2925a1") }
                });

            migrationBuilder.InsertData(
                table: "Bins",
                columns: new[] { "Id", "Code", "CreatedAt", "CreatedBy", "LastModifiedAt", "LastModifiedBy", "MaxCapacity", "ZoneId" },
                values: new object[,]
                {
                    { new Guid("c1000000-0000-0000-0000-000000000001"), "C-Z1-R1-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 100.0, new Guid("f2e96440-1996-4e5b-9d41-3b7c0604b087") },
                    { new Guid("c1000000-0000-0000-0000-000000000002"), "C-Z1-R2-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 100.0, new Guid("f2e96440-1996-4e5b-9d41-3b7c0604b087") },
                    { new Guid("c1000000-0000-0000-0000-000000000003"), "C-Z1-R3-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 100.0, new Guid("f2e96440-1996-4e5b-9d41-3b7c0604b087") },
                    { new Guid("c1000000-0000-0000-0000-000000000004"), "C-Z1-R4-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 100.0, new Guid("f2e96440-1996-4e5b-9d41-3b7c0604b087") },
                    { new Guid("c1000000-0000-0000-0000-000000000005"), "C-Z1-R5-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 100.0, new Guid("f2e96440-1996-4e5b-9d41-3b7c0604b087") },
                    { new Guid("d2000000-0000-0000-0000-000000000001"), "D-Z2-R1-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 500.0, new Guid("e84988e0-087e-40f4-904d-771804d9c02a") },
                    { new Guid("d2000000-0000-0000-0000-000000000002"), "D-Z2-R2-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 500.0, new Guid("e84988e0-087e-40f4-904d-771804d9c02a") },
                    { new Guid("d2000000-0000-0000-0000-000000000003"), "D-Z2-R3-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 500.0, new Guid("e84988e0-087e-40f4-904d-771804d9c02a") },
                    { new Guid("d2000000-0000-0000-0000-000000000004"), "D-Z2-R4-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 500.0, new Guid("e84988e0-087e-40f4-904d-771804d9c02a") },
                    { new Guid("d2000000-0000-0000-0000-000000000005"), "D-Z2-R5-L1", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "SystemAdmin", null, null, 500.0, new Guid("e84988e0-087e-40f4-904d-771804d9c02a") }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Bins_Code",
                table: "Bins",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bins_ZoneId",
                table: "Bins",
                column: "ZoneId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Barcode",
                table: "Products",
                column: "Barcode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_SKU",
                table: "Products",
                column: "SKU",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Zones_WarehouseId",
                table: "Zones",
                column: "WarehouseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Bins");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Zones");

            migrationBuilder.DropTable(
                name: "Warehouses");
        }
    }
}
