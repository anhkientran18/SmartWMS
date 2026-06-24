using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Product> Products { get; }
    DbSet<Bin> Bins { get; }
    DbSet<Zone> Zones { get; }
    DbSet<Warehouse> Warehouses { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<User> Users { get; }
    DbSet<InboundReceipt> InboundReceipts { get; }
    DbSet<OutboundIssue> OutboundIssues { get; }
    DbSet<BinInventory> BinInventories { get; }
    DbSet<InventoryTransaction> InventoryTransactions { get; set; }
    DbSet<OutboundOrderItem> OutboundOrderItems { get; set; }
    DbSet<ProductSerialNumber> ProductSerialNumbers { get; set; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}