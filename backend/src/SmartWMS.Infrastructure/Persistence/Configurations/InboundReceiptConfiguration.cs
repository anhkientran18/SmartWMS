using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class InboundReceiptConfiguration : IEntityTypeConfiguration<InboundReceipt>
{
    public void Configure(EntityTypeBuilder<InboundReceipt> builder)
    {
        builder.Property(x => x.RowVersion).IsRowVersion();
    }
}
