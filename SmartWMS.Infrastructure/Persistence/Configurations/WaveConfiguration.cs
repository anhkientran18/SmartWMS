using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class WaveConfiguration : IEntityTypeConfiguration<Wave>
{
    public void Configure(EntityTypeBuilder<Wave> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.WaveCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(x => x.WaveCode).IsUnique();
        builder.Property(x => x.Priority).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(24).IsRequired();
        builder.Property(x => x.CanonicalTaskSet).IsRequired();
        builder.Property(x => x.TaskSetHash).HasColumnType("varchar(64)").UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.HasIndex(x => x.TaskSetHash).IsUnique();
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.HasOne(x => x.Warehouse).WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("Waves", t =>
        {
            t.HasCheckConstraint("CK_Waves_Identity",
                "LEN(LTRIM(RTRIM([WaveCode]))) > 0 AND LEN([CanonicalTaskSet]) > 0 " +
                "AND DATALENGTH([TaskSetHash]) = 64 AND [TaskSetHash] NOT LIKE '%[^0-9a-f]%'");
            t.HasCheckConstraint("CK_Waves_Status",
                "[Status] IN (N'Created', N'InProgress', N'Picked', N'Staged', N'Completed', N'Cancelled')");
        });
    }
}
