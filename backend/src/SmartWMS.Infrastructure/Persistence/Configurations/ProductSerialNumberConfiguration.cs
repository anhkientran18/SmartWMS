using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class ProductSerialNumberConfiguration : IEntityTypeConfiguration<ProductSerialNumber>
{
    public void Configure(EntityTypeBuilder<ProductSerialNumber> builder)
    {
        // Preserve case. SQL identity equality matches ordinal comparison after outer Trim in intake.
        builder.Property(x => x.SerialCode).HasMaxLength(50)
            .UseCollation("Latin1_General_100_BIN2").IsRequired();
        builder.HasIndex(x => new { x.ProductId, x.SerialCode }).IsUnique();
        builder.Property(x => x.RowVersion).IsRowVersion();
        builder.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<BinInventory>().WithMany().HasForeignKey(x => x.BinInventoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.InboundReceiptItem).WithMany().HasForeignKey(x => x.InboundReceiptItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Reservation).WithMany().HasForeignKey(x => x.ReservationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.ShipmentItem).WithMany().HasForeignKey(x => x.ShipmentItemId).OnDelete(DeleteBehavior.Restrict);
        // Reject every outer whitespace character recognized by .NET Char.IsWhiteSpace/Trim.
        // This also prevents SQL's trailing-space equality from collapsing distinct stored identities.
        const string whitespace = "9,10,11,12,13,32,133,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288";
        builder.ToTable("ProductSerialNumbers", table =>
            table.HasCheckConstraint("CK_ProductSerialNumbers_SerialCode",
                "DATALENGTH([SerialCode]) > 0 AND UNICODE(LEFT([SerialCode], 1)) NOT IN (" + whitespace + ") "
                + "AND UNICODE(RIGHT([SerialCode], 1)) NOT IN (" + whitespace + ")"));
    }
}
