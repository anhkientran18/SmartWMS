using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public class WarehouseConfiguration : IEntityTypeConfiguration<Warehouse>
{
    public void Configure(EntityTypeBuilder<Warehouse> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Name)
               .IsRequired()
               .HasMaxLength(200);

        builder.Property(w => w.Address)
               .HasMaxLength(500);

        // Thiết lập mối quan hệ: 1 Warehouse có nhiều Zone
        builder.HasMany(w => w.Zones)
               .WithOne(z => z.Warehouse)
               .HasForeignKey(z => z.WarehouseId)
               .OnDelete(DeleteBehavior.Restrict); // Dùng Restrict để tránh vô tình xóa kho làm mất luôn dữ liệu Zone bên trong
    }
}