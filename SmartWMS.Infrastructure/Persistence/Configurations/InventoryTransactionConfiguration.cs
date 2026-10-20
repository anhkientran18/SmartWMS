using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> builder)
    {
        builder.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.OutboundOrderItem).WithMany().HasForeignKey(x => x.OutboundOrderItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.InventoryReservation).WithMany().HasForeignKey(x => x.InventoryReservationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.PickTask).WithMany().HasForeignKey(x => x.PickTaskId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.OutboundPickRequest).WithMany().HasForeignKey(x => x.OutboundPickRequestId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.FulfilmentOperationRequest).WithMany().HasForeignKey(x => x.FulfilmentOperationRequestId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Shipment).WithMany().HasForeignKey(x => x.ShipmentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.BinInventory).WithMany().HasForeignKey(x => x.BinInventoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.DestinationBinInventory).WithMany().HasForeignKey(x => x.DestinationBinInventoryId).OnDelete(DeleteBehavior.Restrict);
        // One aggregate internal movement per request/task; multiple source rows use distinct tasks.
        builder.HasIndex(x => new { x.OutboundPickRequestId, x.PickTaskId }).IsUnique()
            .HasFilter("[OutboundPickRequestId] IS NOT NULL AND [PickTaskId] IS NOT NULL")
            .HasDatabaseName("UX_InventoryTransactions_PickMovement");
        builder.HasIndex(x => new { x.ShipmentId, x.InventoryReservationId }).IsUnique()
            .HasFilter("[ShipmentId] IS NOT NULL AND [InventoryReservationId] IS NOT NULL")
            .HasDatabaseName("UX_InventoryTransactions_ShipmentMovement");
        builder.ToTable("InventoryTransactions", table =>
        {
            table.HasCheckConstraint("CK_InventoryTransactions_PickTrace",
                "[OutboundPickRequestId] IS NULL OR ([PickTaskId] IS NOT NULL AND [InventoryReservationId] IS NOT NULL "
                + "AND [OutboundOrderItemId] IS NOT NULL AND [BinInventoryId] IS NOT NULL "
                + "AND [DestinationBinInventoryId] IS NOT NULL AND [BinInventoryId] <> [DestinationBinInventoryId] "
                + "AND [ShipmentId] IS NULL AND [QuantityChanged] <> 0)");
            table.HasCheckConstraint("CK_InventoryTransactions_ShipmentTrace",
                "[ShipmentId] IS NULL OR ([InventoryReservationId] IS NOT NULL AND [OutboundOrderItemId] IS NOT NULL "
                + "AND [BinInventoryId] IS NOT NULL AND [OutboundPickRequestId] IS NULL AND [QuantityChanged] <> 0)");
        });
    }
}
