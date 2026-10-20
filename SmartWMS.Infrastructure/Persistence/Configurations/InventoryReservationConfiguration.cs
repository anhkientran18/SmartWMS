using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class InventoryReservationConfiguration : IEntityTypeConfiguration<InventoryReservation>
{
    public void Configure(EntityTypeBuilder<InventoryReservation> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasAlternateKey(x => new { x.Id, x.AllocationId });
        builder.HasAlternateKey(x => new { x.Id, x.AllocationId, x.OrderId, x.OrderItemId });
        builder.Property(x => x.Status).HasMaxLength(24).IsRequired();
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.HasIndex(x => new { x.AllocationId, x.OrderItemId, x.SourceBinInventoryId }).IsUnique();
        builder.HasOne(x => x.Allocation).WithMany()
            .HasForeignKey(x => new { x.AllocationId, x.OrderId })
            .HasPrincipalKey(x => new { x.Id, x.OrderId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.OrderItem).WithMany()
            .HasForeignKey(x => new { x.OrderItemId, x.OrderId })
            .HasPrincipalKey(x => new { x.Id, x.OrderId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.SourceBinInventory).WithMany().HasForeignKey(x => x.SourceBinInventoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.StagingBinInventory).WithMany().HasForeignKey(x => x.StagingBinInventoryId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("InventoryReservations", t =>
        {
            t.HasCheckConstraint("CK_InventoryReservations_Progress",
                "[Quantity] > 0 AND [PickedQuantity] >= 0 AND [ReleasedQuantity] >= 0 " +
                "AND CAST([PickedQuantity] AS bigint) + [ReleasedQuantity] <= [Quantity] " +
                "AND [ShippedQuantity] >= 0 AND [ShippedQuantity] <= [PickedQuantity]");
            t.HasCheckConstraint("CK_InventoryReservations_Staging",
                "([StagingBinInventoryId] IS NULL OR [StagingBinInventoryId] <> [SourceBinInventoryId]) " +
                "AND ([PickedQuantity] = 0 OR [StagingBinInventoryId] IS NOT NULL)");
            t.HasCheckConstraint("CK_InventoryReservations_Status",
                "[Status] IN (N'Active', N'PartiallyPicked', N'Picked', N'Shipped', N'Released')");
        });
    }
}
