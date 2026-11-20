using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class PickTaskConfiguration : IEntityTypeConfiguration<PickTask>
{
    public void Configure(EntityTypeBuilder<PickTask> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasAlternateKey(x => new { x.Id, x.AllocationId });
        builder.HasIndex(x => x.ReservationId).IsUnique();
        builder.Property(x => x.Status).HasMaxLength(24).IsRequired();
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.HasOne(x => x.Reservation).WithMany()
            .HasForeignKey(x => new { x.ReservationId, x.AllocationId })
            .HasPrincipalKey(x => new { x.Id, x.AllocationId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.SourceBin).WithMany().HasForeignKey(x => x.SourceBinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.StagingBin).WithMany().HasForeignKey(x => x.StagingBinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.AssignedUser).WithMany().HasForeignKey(x => x.AssignedUserId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("PickTasks", t =>
        {
            t.HasCheckConstraint("CK_PickTasks_Progress",
                "[Quantity] > 0 AND [StagedQuantity] >= 0 AND [StagedQuantity] <= [PickedQuantity] AND [PickedQuantity] <= [Quantity]");
            t.HasCheckConstraint("CK_PickTasks_Bins", "[SourceBinId] <> [StagingBinId]");
            t.HasCheckConstraint("CK_PickTasks_Status",
                "[Status] IN (N'Ready', N'Waved', N'Picking', N'Picked', N'Staged', N'Completed', N'Released')");
        });
    }
}
