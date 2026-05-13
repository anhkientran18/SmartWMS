using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<Bin> Bins => Set<Bin>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Tự động áp dụng các Fluent API Configurations đã viết ở bước trước
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Khởi tạo Seed Data 
        SeedWarehouseData(modelBuilder);

        base.OnModelCreating(modelBuilder);
    }

    private void SeedWarehouseData(ModelBuilder modelBuilder)
    {
        // Khởi tạo một mốc thời gian cố định thay vì dùng DateTime.UtcNow
        var fixedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // 1. Khởi tạo Kho hàng (Warehouse)
        var warehouseId = Guid.Parse("7a9089f2-2b22-4211-912b-28562d2925a1");
        modelBuilder.Entity<Warehouse>().HasData(new Warehouse
        {
            Id = warehouseId,
            Name = "Kho Tổng Thông Minh - SmartWMS Center",
            Address = "Khu Công Nghệ Cao, Quận 9, TP. Thủ Đức",
            CreatedBy = "SystemAdmin",
            CreatedAt = fixedDate // Phải override giá trị mặc định của BaseEntity
        });

        // 2. Khởi tạo 2 Khu vực (Zones)
        var coldZoneId = Guid.Parse("f2e96440-1996-4e5b-9d41-3b7c0604b087");
        var dryZoneId = Guid.Parse("e84988e0-087e-40f4-904d-771804d9c02a");

        modelBuilder.Entity<Zone>().HasData(
            new Zone { Id = coldZoneId, Name = "Khu Mát (Cold Zone)", WarehouseId = warehouseId, CreatedBy = "SystemAdmin", CreatedAt = fixedDate },
            new Zone { Id = dryZoneId, Name = "Khu Khô (Dry Zone)", WarehouseId = warehouseId, CreatedBy = "SystemAdmin", CreatedAt = fixedDate }
        );

        // 3. Khởi tạo 10 Vị trí kệ (Bins) với các GUID tĩnh
        var coldBinIds = new[] {
            Guid.Parse("c1000000-0000-0000-0000-000000000001"),
            Guid.Parse("c1000000-0000-0000-0000-000000000002"),
            Guid.Parse("c1000000-0000-0000-0000-000000000003"),
            Guid.Parse("c1000000-0000-0000-0000-000000000004"),
            Guid.Parse("c1000000-0000-0000-0000-000000000005")
        };

        for (int i = 0; i < 5; i++)
        {
            modelBuilder.Entity<Bin>().HasData(new Bin
            {
                Id = coldBinIds[i],
                Code = $"C-Z1-R{i + 1}-L1",
                ZoneId = coldZoneId,
                MaxCapacity = 100,
                CurrentOccupancy = 0,
                CreatedBy = "SystemAdmin",
                CreatedAt = fixedDate
            });
        }

        var dryBinIds = new[] {
            Guid.Parse("d2000000-0000-0000-0000-000000000001"),
            Guid.Parse("d2000000-0000-0000-0000-000000000002"),
            Guid.Parse("d2000000-0000-0000-0000-000000000003"),
            Guid.Parse("d2000000-0000-0000-0000-000000000004"),
            Guid.Parse("d2000000-0000-0000-0000-000000000005")
        };

        for (int i = 0; i < 5; i++)
        {
            modelBuilder.Entity<Bin>().HasData(new Bin
            {
                Id = dryBinIds[i],
                Code = $"D-Z2-R{i + 1}-L1",
                ZoneId = dryZoneId,
                MaxCapacity = 500,
                CurrentOccupancy = 0,
                CreatedBy = "SystemAdmin",
                CreatedAt = fixedDate
            });
        }
    }
}