using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence.Configurations;

public sealed class OutboundIssueConfiguration : IEntityTypeConfiguration<OutboundIssue>
{
    public void Configure(EntityTypeBuilder<OutboundIssue> builder)
    {
        builder.Property(x => x.RowVersion).IsRowVersion();
    }
}
