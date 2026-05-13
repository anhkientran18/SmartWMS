using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public class ZoneConfiguration : IEntityTypeConfiguration<Zone>
{
    public void Configure(EntityTypeBuilder<Zone> builder)
    {
        builder.HasKey(z => z.Id);

        builder.Property(z => z.Name)
               .IsRequired()
               .HasMaxLength(100);

        // Thiết lập mối quan hệ: 1 Zone có nhiều Bin
        builder.HasMany(z => z.Bins)
               .WithOne(b => b.Zone)
               .HasForeignKey(b => b.ZoneId)
               .OnDelete(DeleteBehavior.Cascade); // Xóa Zone có thể cho phép xóa luôn các Bin (Kệ) rỗng bên trong
    }
}