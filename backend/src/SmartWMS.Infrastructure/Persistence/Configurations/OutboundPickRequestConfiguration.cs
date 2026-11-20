using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class OutboundPickRequestConfiguration : IEntityTypeConfiguration<OutboundPickRequest>
{
    public void Configure(EntityTypeBuilder<OutboundPickRequest> builder)
    {
        builder.HasKey(x => x.RequestId);
        builder.HasAlternateKey(x => new { x.RequestId, x.AllocationId });
        builder.Property(x => x.RequestId).ValueGeneratedNever();
        builder.Property(x => x.TrackingMode).HasConversion<int>();
        builder.Property(x => x.LotNumber).HasMaxLength(50);
        builder.Property(x => x.NaturalPickKey).HasColumnType("varchar(64)").UseCollation("Latin1_General_100_BIN2");
        builder.Property(x => x.CanonicalPayload).IsRequired();
        builder.Property(x => x.PayloadHash).HasColumnType("varchar(64)").UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.Property(x => x.Status).HasMaxLength(24).IsRequired();
        builder.HasIndex(x => new { x.AllocationId, x.NaturalPickKey }).IsUnique().HasFilter("[NaturalPickKey] IS NOT NULL");
        builder.HasOne(x => x.Allocation).WithMany()
            .HasForeignKey(x => new { x.AllocationId, x.OrderId })
            .HasPrincipalKey(x => new { x.Id, x.OrderId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.OrderItem).WithMany()
            .HasForeignKey(x => new { x.OrderItemId, x.OrderId })
            .HasPrincipalKey(x => new { x.Id, x.OrderId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Bin).WithMany().HasForeignKey(x => x.BinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.StagingBin).WithMany().HasForeignKey(x => x.StagingBinId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("OutboundPickRequests", t =>
        {
            t.HasCheckConstraint("CK_OutboundPickRequests_Payload",
                "[QuantityPicked] > 0 AND [TrackingMode] IN (0, 1, 2) AND [BinId] <> [StagingBinId] " +
                "AND ([TrackingMode] <> 1 OR LEN(LTRIM(RTRIM([LotNumber]))) > 0 AND [LotNumber] IS NOT NULL) " +
                "AND ([TrackingMode] = 2 OR [OrderItemId] IS NOT NULL)");
            t.HasCheckConstraint("CK_OutboundPickRequests_Result",
                "[Status] = N'Completed' AND LEN([CanonicalPayload]) > 0 " +
                "AND DATALENGTH([PayloadHash]) = 64 AND [PayloadHash] NOT LIKE '%[^0-9a-f]%' " +
                "AND ([NaturalPickKey] IS NULL OR DATALENGTH([NaturalPickKey]) = 64 AND [NaturalPickKey] NOT LIKE '%[^0-9a-f]%')");
        });
    }
}
