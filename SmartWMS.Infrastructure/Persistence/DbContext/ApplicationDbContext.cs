using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Persistence.DbContext;

public class ApplicationDbContext : Microsoft.EntityFrameworkCore.DbContext, IApplicationDbContext
{
    private readonly ICurrentUserService _currentUserService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentUserService currentUserService) : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<Product> Products { get; set; }
    public DbSet<Bin> Bins { get; set; }
    public DbSet<Zone> Zones { get; set; }
    public DbSet<Warehouse> Warehouses { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Supplier> Suppliers { get; set; } // 🌟 BỔ SUNG: Danh mục Nhà cung cấp cốt lõi
    public DbSet<Customer> Customers { get; set; } // 🌟 BỔ SUNG: Danh mục Khách hàng cốt lõi
    public DbSet<InboundReceipt> InboundReceipts { get; set; }
    public DbSet<InboundReceiptItem> InboundReceiptItems { get; set; }
    public DbSet<OutboundIssue> OutboundIssues { get; set; }
    public DbSet<BinInventory> BinInventories => Set<BinInventory>();
    public DbSet<InventoryTransaction> InventoryTransactions { get; set; }
    public DbSet<OutboundOrderItem> OutboundOrderItems { get; set; }
    public DbSet<ProductSerialNumber> ProductSerialNumbers { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

        // ============================================================================
        // 🌟 LÁ CHẮN BẢO VỆ CẤU TRÚC: CHẶN XÓA BẮC CẦU (CASCADE CONSTRAINTS)
        // Cấu hình Restrict nhằm ngăn chặn SQL Server báo lỗi trùng lặp nhánh xóa dữ liệu.
        // ============================================================================

        // 1. Bảo vệ mối quan hệ Chi tiết phiếu nhập -> Sản phẩm
        modelBuilder.Entity<InboundReceiptItem>(entity =>
        {
            entity.HasOne(d => d.Product)
                  .WithMany()
                  .HasForeignKey(d => d.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // 2. Bảo vệ mối quan hệ Phiếu nhập kho tổng -> Nhà cung cấp (Chặn xóa NCC nếu đã có lịch sử chứng từ)
        modelBuilder.Entity<InboundReceipt>(entity =>
        {
            entity.HasOne(d => d.Supplier)
                  .WithMany()
                  .HasForeignKey(d => d.SupplierId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // 3. Bảo vệ mối quan hệ Phiếu xuất kho tổng -> Khách hàng (Chặn xóa Khách hàng nếu đã có lịch sử xuất)
        modelBuilder.Entity<OutboundIssue>(entity =>
        {
            entity.HasOne(d => d.Customer)
                  .WithMany()
                  .HasForeignKey(d => d.CustomerId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
        // ============================================================================

        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // 1. Lập tức chạy bộ máy điền thông tin kiểm toán ngầm và trích xuất log thay đổi
        var auditEntries = OnBeforeSaveChanges();

        // 2. Lưu các thay đổi chính thức vào SQL Server
        var result = await base.SaveChangesAsync(cancellationToken);

        // 3. Xử lý lưu lịch sử Log chi tiết vào database
        await OnAfterSaveChangesAsync(auditEntries);

        return result;
    }

    private List<AuditEntry> OnBeforeSaveChanges()
    {
        ChangeTracker.DetectChanges();
        var auditEntries = new List<AuditEntry>();

        var userId = _currentUserService.UserId ?? "SystemAdmin";
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is AuditLog || entry.State == EntityState.Detached || entry.State == EntityState.Unchanged)
                continue;

            if (entry.State == EntityState.Added)
            {
                SetPropertyValue(entry.Entity, "CreatedAt", utcNow);
                SetPropertyValue(entry.Entity, "CreatedBy", userId);
            }

            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                SetPropertyValue(entry.Entity, "UpdatedAt", utcNow);
                SetPropertyValue(entry.Entity, "UpdatedBy", userId);
            }

            var auditEntry = new AuditEntry(entry)
            {
                TableName = entry.Metadata.GetTableName() ?? entry.Metadata.Name,
                UserId = userId
            };
            auditEntries.Add(auditEntry);

            foreach (var property in entry.Properties)
            {
                if (property.IsTemporary) continue;
                string propertyName = property.Metadata.Name;
                if (property.Metadata.IsPrimaryKey()) continue;

                switch (entry.State)
                {
                    case EntityState.Added:
                        auditEntry.AuditType = "C";
                        auditEntry.NewValues[propertyName] = property.CurrentValue;
                        break;
                    case EntityState.Deleted:
                        auditEntry.AuditType = "D";
                        auditEntry.OldValues[propertyName] = property.OriginalValue;
                        break;
                    case EntityState.Modified:
                        if (property.IsModified)
                        {
                            auditEntry.AuditType = "U";
                            auditEntry.OldValues[propertyName] = property.OriginalValue;
                            auditEntry.NewValues[propertyName] = property.CurrentValue;
                        }
                        break;
                }
            }
        }
        return auditEntries;
    }

    private async Task OnAfterSaveChangesAsync(List<AuditEntry> auditEntries)
    {
        if (auditEntries == null || auditEntries.Count == 0) return;

        foreach (var auditEntry in auditEntries)
        {
            var affectedColumns = new List<string>();
            if (auditEntry.NewValues.Any()) affectedColumns.AddRange(auditEntry.NewValues.Keys);
            if (auditEntry.OldValues.Any()) affectedColumns.AddRange(auditEntry.OldValues.Keys);

            var log = new AuditLog
            {
                TableName = auditEntry.TableName,
                Type = auditEntry.AuditType,
                OldValues = auditEntry.OldValues.Count == 0 ? null : JsonSerializer.Serialize(auditEntry.OldValues),
                NewValues = auditEntry.NewValues.Count == 0 ? null : JsonSerializer.Serialize(auditEntry.NewValues),
                DateTime = DateTime.UtcNow,
                UserId = auditEntry.UserId,
                IpAddress = _currentUserService.IpAddress,
                AffectedColumns = string.Join(", ", affectedColumns.Distinct())
            };

            AuditLogs.Add(log);
        }
        await base.SaveChangesAsync();
    }

    private void SetPropertyValue(object entity, string propertyName, object value)
    {
        var property = entity.GetType().GetProperty(propertyName);
        if (property != null && property.CanWrite)
        {
            property.SetValue(entity, value, null);
        }
    }

    private class AuditEntry
    {
        public AuditEntry(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry) { Entry = entry; }
        public Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry Entry { get; }
        public string TableName { get; set; } = string.Empty;
        public string AuditType { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public Dictionary<string, object?> OldValues { get; } = new();
        public Dictionary<string, object?> NewValues { get; } = new();
    }
}