using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using System.Text.Json;

namespace SmartWMS.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    private readonly ICurrentUserService _currentUserService;
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentUserService currentUserService) : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<Bin> Bins => Set<Bin>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>(); // Thực thi Interface

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // 1. Phân tích các thay đổi trước khi ghi vào Database
        var auditEntries = OnBeforeSaveChanges();

        // 2. Lưu dữ liệu chính (Sản phẩm, Vị trí kho, Kệ hàng...)
        var result = await base.SaveChangesAsync(cancellationToken);

        // 3. Nếu có thay đổi, ghi các bản ghi nhật ký Audit Log vào hệ thống
        if (auditEntries.Any())
        {
            AuditLogs.AddRange(auditEntries);
            await base.SaveChangesAsync(cancellationToken);
        }

        return result;
    }

    private List<AuditLog> OnBeforeSaveChanges()
    {
        ChangeTracker.DetectChanges();
        var auditEntries = new List<AuditLog>();

        foreach (var entry in ChangeTracker.Entries())
        {
            // Không log chính bảng AuditLog hoặc các thực thể không thay đổi
            if (entry.Entity is AuditLog || entry.State == EntityState.Detached || entry.State == EntityState.Unchanged)
                continue;

            var auditEntry = new AuditLog
            {
                Id = Guid.NewGuid(),
                DateTime = DateTime.UtcNow,
                TableName = entry.Metadata.GetTableName() ?? entry.Metadata.Name,
                UserId = "System_User" // Tạm thời để cứng, bước sau ta sẽ tiêm CurrentUserService lấy từ JWT
            };

            auditEntries.Add(auditEntry);

            var oldValues = new Dictionary<string, object>();
            var newValues = new Dictionary<string, object>();
            var changedColumns = new List<string>();

            switch (entry.State)
            {
                case EntityState.Added:
                    auditEntry.Type = "Create";
                    foreach (var property in entry.Properties)
                    {
                        if (property.Metadata.IsPrimaryKey()) continue;
                        newValues[property.Metadata.Name] = property.CurrentValue ?? string.Empty;
                    }
                    auditEntry.NewValues = JsonSerializer.Serialize(newValues);
                    break;

                case EntityState.Deleted:
                    auditEntry.Type = "Delete";
                    foreach (var property in entry.Properties)
                    {
                        oldValues[property.Metadata.Name] = property.OriginalValue ?? string.Empty;
                    }
                    auditEntry.OldValues = JsonSerializer.Serialize(oldValues);
                    break;

                case EntityState.Modified:
                    auditEntry.Type = "Update";
                    foreach (var property in entry.Properties)
                    {
                        if (property.IsModified)
                        {
                            changedColumns.Add(property.Metadata.Name);
                            oldValues[property.Metadata.Name] = property.OriginalValue ?? string.Empty;
                            newValues[property.Metadata.Name] = property.CurrentValue ?? string.Empty;
                        }
                    }
                    auditEntry.OldValues = JsonSerializer.Serialize(oldValues);
                    auditEntry.NewValues = JsonSerializer.Serialize(newValues);
                    auditEntry.AffectedColumns = string.Join(", ", changedColumns);
                    break;
            }
        }

        return auditEntries;
    }
}