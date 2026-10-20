using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public class BinConfiguration : IEntityTypeConfiguration<Bin>
{
    public void Configure(EntityTypeBuilder<Bin> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Purpose).HasConversion<int>()
            .IsRequired().HasDefaultValue(BinPurpose.Storage);
        builder.Property(b => b.RowVersion).IsRowVersion();
        builder.ToTable("Bins", table =>
        {
            table.HasCheckConstraint("CK_Bins_Purpose", "[Purpose] IN (0, 1)");
            table.HasCheckConstraint("CK_Bins_Occupancy",
                "[MaxCapacity] >= 0 AND [CurrentOccupancy] >= 0 AND [CurrentOccupancy] <= [MaxCapacity]");
        });

        builder.Property(b => b.Code)
               .IsRequired()
               .HasMaxLength(50);

        // Đảm bảo mã Bin (Code) là duy nhất trong toàn hệ thống để nhân viên quét không bị nhầm lẫn
        builder.HasIndex(b => b.Code).IsUnique();

        builder.Property(b => b.MaxCapacity)
               .IsRequired();

        builder.Property(b => b.CurrentOccupancy)
               .IsRequired()
               .HasDefaultValue(0); // Mặc định khi tạo Bin mới là trống (0)
    }
}