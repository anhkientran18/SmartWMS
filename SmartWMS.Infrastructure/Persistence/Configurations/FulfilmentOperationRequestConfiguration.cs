using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class FulfilmentOperationRequestConfiguration : IEntityTypeConfiguration<FulfilmentOperationRequest>
{
    public void Configure(EntityTypeBuilder<FulfilmentOperationRequest> builder)
    {
        builder.HasKey(x => x.RequestId);
        builder.Property(x => x.RequestId).ValueGeneratedNever();
        builder.Property(x => x.OperationKind).HasMaxLength(32).IsRequired();
        builder.Property(x => x.ScopeKey).HasMaxLength(128).UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.Property(x => x.NaturalOperationKey).HasColumnType("varchar(64)").UseCollation("Latin1_General_100_BIN2");
        builder.Property(x => x.CanonicalPayload).IsRequired();
        builder.Property(x => x.PayloadHash).HasColumnType("varchar(64)").UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.Property(x => x.CompletedResponseJson).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(24).IsRequired();
        builder.HasIndex(x => new { x.OperationKind, x.ScopeKey, x.NaturalOperationKey })
            .IsUnique().HasFilter("[NaturalOperationKey] IS NOT NULL");
        builder.HasOne(x => x.Allocation).WithMany()
            .HasForeignKey(x => new { x.AllocationId, x.OrderId })
            .HasPrincipalKey(x => new { x.Id, x.OrderId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.InboundReceipt).WithMany().HasForeignKey(x => x.InboundReceiptId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Wave).WithMany().HasForeignKey(x => x.WaveId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Shipment).WithMany().HasForeignKey(x => x.ShipmentId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("FulfilmentOperationRequests", t =>
        {
            t.HasCheckConstraint("CK_FulfilmentOperationRequests_Operation",
                "[OperationKind] IN (N'ReceiveInbound', N'Allocate', N'CreateWave', N'ConfirmStaging', N'ReleaseAllocation', N'Ship')");
            t.HasCheckConstraint("CK_FulfilmentOperationRequests_Scope",
                "([OperationKind] = N'ReceiveInbound' AND [InboundReceiptId] IS NOT NULL AND [AllocationId] IS NULL " +
                "AND [ScopeKey] = N'inbound:' + LOWER(CONVERT(nvarchar(36), [InboundReceiptId]))) OR " +
                "([OperationKind] = N'CreateWave' AND [WaveId] IS NOT NULL AND [AllocationId] IS NULL " +
                "AND [ScopeKey] LIKE N'wave:%' AND LEN([ScopeKey]) = 69) OR " +
                "([OperationKind] IN (N'Allocate', N'ConfirmStaging', N'ReleaseAllocation', N'Ship') " +
                "AND [AllocationId] IS NOT NULL AND [OrderId] IS NOT NULL " +
                "AND [ScopeKey] = N'allocation:' + LOWER(CONVERT(nvarchar(36), [AllocationId])) " +
                "AND ([OperationKind] <> N'Ship' OR [ShipmentId] IS NOT NULL))");
            t.HasCheckConstraint("CK_FulfilmentOperationRequests_Result",
                "[Status] = N'Completed' AND LEN([CanonicalPayload]) > 0 " +
                "AND LEN([CompletedResponseJson]) > 0 AND DATALENGTH([PayloadHash]) = 64 AND [PayloadHash] NOT LIKE '%[^0-9a-f]%' " +
                "AND ([NaturalOperationKey] IS NULL OR DATALENGTH([NaturalOperationKey]) = 64 AND [NaturalOperationKey] NOT LIKE '%[^0-9a-f]%')");
        });
    }
}
