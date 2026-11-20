using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class WavePickTaskConfiguration : IEntityTypeConfiguration<WavePickTask>
{
    public void Configure(EntityTypeBuilder<WavePickTask> builder)
    {
        builder.HasKey(x => new { x.WaveId, x.PickTaskId });
        builder.HasIndex(x => x.PickTaskId).IsUnique().HasFilter("[IsActive] = 1")
            .HasDatabaseName("UX_WavePickTasks_ActiveTask");
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.HasOne(x => x.Wave).WithMany().HasForeignKey(x => x.WaveId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.PickTask).WithMany().HasForeignKey(x => x.PickTaskId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("WavePickTasks", t =>
            t.HasCheckConstraint("CK_WavePickTasks_Membership",
                "([IsActive] = 1 AND [RemovedAt] IS NULL) OR ([IsActive] = 0 AND [RemovedAt] IS NOT NULL)"));
    }
}
