using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class ShipmentConfiguration : IEntityTypeConfiguration<Shipment>
{
    public void Configure(EntityTypeBuilder<Shipment> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasAlternateKey(x => new { x.Id, x.AllocationId, x.OrderId });
        // Whole-order shipping v1 policy only: this index can be relaxed for future partial shipments.
        // OrderId is not the PK and there is no unique allocation FK that hard-codes a one-to-one model.
        builder.HasIndex(x => x.OrderId).IsUnique().HasDatabaseName("UX_Shipments_OrderId_WholeOrderV1");
        builder.Property(x => x.CanonicalPackingPayload).IsRequired();
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Allocation).WithMany()
            .HasForeignKey(x => new { x.AllocationId, x.OrderId })
            .HasPrincipalKey(x => new { x.Id, x.OrderId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.StagingBin).WithMany().HasForeignKey(x => x.StagingBinId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("Shipments", t =>
            t.HasCheckConstraint("CK_Shipments_Packing", "LEN([CanonicalPackingPayload]) > 0"));
    }
}
