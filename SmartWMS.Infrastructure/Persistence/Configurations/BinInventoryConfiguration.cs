using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public class BinInventoryConfiguration : IEntityTypeConfiguration<BinInventory>
{
    public void Configure(EntityTypeBuilder<BinInventory> builder)
    {
        builder.ToTable("BinInventories");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.LotNumber)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Quantity)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.Status)
            .HasConversion<int>()
            .IsRequired();

        // BỔ SUNG QUAN TRỌNG: Cấu hình dữ liệu kiểu RowVersion/Timestamp trong SQL Server
        builder.Property(x => x.RowVersion)
            .IsRowVersion()
            .IsConcurrencyToken();

        builder.HasOne(x => x.Bin)
            .WithMany(b => b.BinInventories)
            .HasForeignKey(x => x.BinId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Product)
            .WithMany(p => p.BinInventories)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.LotNumber);
        builder.HasIndex(x => x.ExpirationDate);
        builder.HasIndex(x => new { x.BinId, x.ProductId, x.LotNumber, x.Status }).IsUnique();
    }
}