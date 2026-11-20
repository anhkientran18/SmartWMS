using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SmartWMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLogTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("c1000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("c1000000-0000-0000-0000-000000000002"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("c1000000-0000-0000-0000-000000000003"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("c1000000-0000-0000-0000-000000000004"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("c1000000-0000-0000-0000-000000000005"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("d2000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("d2000000-0000-0000-0000-000000000002"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("d2000000-0000-0000-0000-000000000003"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("d2000000-0000-0000-0000-000000000004"));

            migrationBuilder.DeleteData(
                table: "Bins",
                keyColumn: "Id",
                keyValue: new Guid("d2000000-0000-0000-0000-000000000005"));

            migrationBuilder.DeleteData(
                table: "Zones",
                keyColumn: "Id",
                keyValue: new Guid("e84988e0-087e-40f4-904d-771804d9c02a"));

            migrationBuilder.DeleteData(
                table: "Zones",
                keyColumn: "Id",
                keyValue: new Guid("f2e96440-1996-4e5b-9d41-3b7c0604b087"));

            migrationBuilder.DeleteData(
                table: "Warehouses",
                keyColumn: "Id",
                keyValue: new Guid("7a9089f2-2b22-4211-912b-28562d2925a1"));

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TableName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OldValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AffectedColumns = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

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
        }
    }
}
