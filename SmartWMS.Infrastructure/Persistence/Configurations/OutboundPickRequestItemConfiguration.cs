using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class OutboundPickRequestItemConfiguration : IEntityTypeConfiguration<OutboundPickRequestItem>
{
    public void Configure(EntityTypeBuilder<OutboundPickRequestItem> builder)
    {
        builder.HasKey(x => new { x.RequestId, x.PickTaskId });
        builder.HasOne(x => x.Request).WithMany()
            .HasForeignKey(x => new { x.RequestId, x.AllocationId })
            .HasPrincipalKey(x => new { x.RequestId, x.AllocationId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.PickTask).WithMany()
            .HasForeignKey(x => new { x.PickTaskId, x.AllocationId })
            .HasPrincipalKey(x => new { x.Id, x.AllocationId }).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("OutboundPickRequestItems", t =>
            t.HasCheckConstraint("CK_OutboundPickRequestItems_Quantity", "[QuantityPicked] > 0"));
    }
}
