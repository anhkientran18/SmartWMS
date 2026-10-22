using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class OutboundAllocationConfiguration : IEntityTypeConfiguration<OutboundAllocation>
{
    public void Configure(EntityTypeBuilder<OutboundAllocation> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasAlternateKey(x => new { x.Id, x.OrderId });
        builder.HasAlternateKey(x => new { x.Id, x.OrderId, x.IsDirectPick });
        builder.Property(x => x.IsDirectPick).HasDefaultValue(false);
        builder.Property(x => x.Status).HasMaxLength(24).IsRequired();
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.HasIndex(x => new { x.OrderId, x.Generation }).IsUnique();
        builder.HasIndex(x => x.OrderId).IsUnique().HasFilter("[IsActive] = 1")
            .HasDatabaseName("UX_OutboundAllocations_ActiveOrder");
        builder.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.SourceBin).WithMany().HasForeignKey(x => x.SourceBinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.StagingBin).WithMany().HasForeignKey(x => x.StagingBinId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("OutboundAllocations", t =>
        {
            t.HasCheckConstraint("CK_OutboundAllocations_Generation", "[Generation] > 0");
            t.HasCheckConstraint("CK_OutboundAllocations_Bins",
                "([IsDirectPick] = 1 AND [StagingBinId] IS NULL) OR " +
                "([IsDirectPick] = 0 AND [StagingBinId] IS NOT NULL AND [SourceBinId] <> [StagingBinId])");
            t.HasCheckConstraint("CK_OutboundAllocations_State",
                "([IsActive] = 1 AND [Status] IN (N'Active', N'Picking', N'Picked', N'Staged')) " +
                "OR ([IsActive] = 0 AND [Status] IN (N'Released', N'Shipped'))");
        });
    }
}
