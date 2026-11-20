using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.TrackingMode).HasConversion<int>()
            .IsRequired().HasDefaultValue(ProductTrackingMode.None);
        builder.ToTable("Products", table =>
            table.HasCheckConstraint("CK_Products_TrackingMode", "[TrackingMode] IN (0, 1, 2)"));

        // Mã SKU và Barcode bắt buộc phải có và là duy nhất
        builder.Property(p => p.SKU).IsRequired().HasMaxLength(50);
        builder.HasIndex(p => p.SKU).IsUnique();

        builder.Property(p => p.Barcode).IsRequired().HasMaxLength(100);
        builder.HasIndex(p => p.Barcode).IsUnique();

        builder.Property(p => p.Name).IsRequired().HasMaxLength(255);
        builder.Property(p => p.Unit).HasMaxLength(20);
    }
}