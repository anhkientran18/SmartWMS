using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class InboundReceiptItemConfiguration : IEntityTypeConfiguration<InboundReceiptItem>
{
    public void Configure(EntityTypeBuilder<InboundReceiptItem> builder)
    {
        builder.Property(x => x.TrackingModeSnapshot).HasConversion<int>();
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.ToTable("InboundReceiptItems", table =>
            table.HasCheckConstraint("CK_InboundReceiptItems_TrackingMode",
                "[TrackingModeSnapshot] IS NULL OR [TrackingModeSnapshot] IN (0, 1, 2)"));
    }
}
