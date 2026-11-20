using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class ShipmentItemConfiguration : IEntityTypeConfiguration<ShipmentItem>
{
    public void Configure(EntityTypeBuilder<ShipmentItem> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.ShipmentId, x.ReservationId }).IsUnique();
        builder.HasOne(x => x.Shipment).WithMany()
            .HasForeignKey(x => new { x.ShipmentId, x.AllocationId, x.OrderId })
            .HasPrincipalKey(x => new { x.Id, x.AllocationId, x.OrderId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Reservation).WithMany()
            .HasForeignKey(x => new { x.ReservationId, x.AllocationId, x.OrderId, x.OrderItemId })
            .HasPrincipalKey(x => new { x.Id, x.AllocationId, x.OrderId, x.OrderItemId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.BinInventory).WithMany().HasForeignKey(x => x.BinInventoryId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("ShipmentItems", t =>
            t.HasCheckConstraint("CK_ShipmentItems_Quantity", "[Quantity] > 0"));
    }
}
