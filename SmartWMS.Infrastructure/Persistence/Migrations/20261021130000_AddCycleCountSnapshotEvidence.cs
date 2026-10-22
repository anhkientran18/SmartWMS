using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartWMS.Infrastructure.Migrations;

public partial class AddCycleCountSnapshotEvidence : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "SnapshotBinInventoryId", table: "CycleCountItems",
            type: "uniqueidentifier", nullable: true);
        migrationBuilder.AddColumn<byte[]>(
            name: "SnapshotRowVersion", table: "CycleCountItems",
            type: "binary(8)", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "SnapshotBinInventoryId", table: "CycleCountItems");
        migrationBuilder.DropColumn(name: "SnapshotRowVersion", table: "CycleCountItems");
    }
}
