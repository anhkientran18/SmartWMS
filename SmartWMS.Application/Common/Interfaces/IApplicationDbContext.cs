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
    DbSet<Supplier> Suppliers { get; }
    DbSet<Customer> Customers { get; }
    DbSet<CycleCountSheet> CycleCountSheets { get; }
    DbSet<CycleCountItem> CycleCountItems { get; }
    DbSet<OutboundAllocation> OutboundAllocations { get; }
    DbSet<InventoryReservation> InventoryReservations { get; }
    DbSet<PickTask> PickTasks { get; }
    DbSet<Wave> Waves { get; }
    DbSet<Shipment> Shipments { get; }
    DbSet<ShipmentItem> ShipmentItems { get; }
    DbSet<WavePickTask> WavePickTasks { get; }
    DbSet<OutboundPickRequest> OutboundPickRequests { get; }
    DbSet<OutboundPickRequestItem> OutboundPickRequestItems { get; }
    DbSet<FulfilmentOperationRequest> FulfilmentOperationRequests { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
