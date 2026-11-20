using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class OutboundOrderItemConfiguration : IEntityTypeConfiguration<OutboundOrderItem>
{
    public void Configure(EntityTypeBuilder<OutboundOrderItem> builder)
    {
        builder.HasAlternateKey(x => new { x.Id, x.OrderId });
        builder.HasAlternateKey(x => new { x.Id, x.OrderId, x.IsDirectPick });
        builder.Property(x => x.IsDirectPick).HasDefaultValue(false);
        builder.Property(x => x.TrackingModeSnapshot).HasConversion<int>();
        builder.Property(x => x.ReservedQuantity).HasDefaultValue(0);
        builder.Property(x => x.PickedQuantity).HasDefaultValue(0);
        builder.Property(x => x.StagedQuantity).HasDefaultValue(0);
        builder.Property(x => x.ShippedQuantity).HasDefaultValue(0);
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.ToTable("OutboundOrderItems", table =>
        {
            table.HasCheckConstraint("CK_OutboundOrderItems_TrackingMode",
                "[TrackingModeSnapshot] IS NULL OR [TrackingModeSnapshot] IN (0, 1, 2)");
            table.HasCheckConstraint("CK_OutboundOrderItems_Progress",
                "[ReservedQuantity] >= 0 AND [ShippedQuantity] >= 0 "
                + "AND (([IsDirectPick] = 0 AND [ShippedQuantity] <= [StagedQuantity] AND [StagedQuantity] <= [PickedQuantity]) "
                + "OR ([IsDirectPick] = 1 AND [StagedQuantity] = 0 AND [PickedQuantity] >= 0 AND [ShippedQuantity] <= [PickedQuantity])) "
                + "AND [PickedQuantity] <= [Quantity] AND [ReservedQuantity] <= [Quantity] - [ShippedQuantity]");
        });
    }
}
