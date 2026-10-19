using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Persistence.Initializers;

public static class DbInitializer
{
    public static async Task SeedAsync(ApplicationDbContext context, IPasswordHasher passwordHasher,
        IConfiguration configuration, IEmbeddingService? embeddingService = null)
    {
        // 1. Seed Tài khoản Admin hệ thống
        await SeedAdminUserAsync(context, passwordHasher, configuration);

        // 2. Seed Master Data Cấu trúc Kho bãi (Warehouses, Zones, Bins)
        await SeedWarehouseStructureAsync(context);

        // 3. Seed Danh mục Sản phẩm mẫu & Khởi tạo Vector Embedding cho AI Search
        if (embeddingService != null)
        {
            await InitialDbSeed.SeedDataAsync(context, embeddingService);
        }
    }

    private static async Task SeedAdminUserAsync(ApplicationDbContext context, IPasswordHasher passwordHasher,
        IConfiguration configuration)
    {
        if (!await context.Users.AnyAsync())
        {
            var password = configuration["SeedAdmin:Password"];
            if (string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException("Cần cấu hình SeedAdmin:Password bên ngoài source trước khi khởi tạo admin.");

            var adminUser = new User
            {
                Username = "admin",
                PasswordHash = passwordHasher.HashPassword(password),
                LastName = "Quản Trị",
                FirstName = "Viên",
                Role = "Admin",
                IsActive = true,
                Email = "admin@smartwms.com",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System"
            };

            context.Users.Add(adminUser);
            await context.SaveChangesAsync();
        }
    }

    private static async Task SeedWarehouseStructureAsync(ApplicationDbContext context)
    {
        if (await context.Warehouses.AnyAsync()) return;

        var warehouseId = Guid.Parse("7a9089f2-2b22-4211-912b-28562d2925a1");
        var dryZoneId = Guid.Parse("e84988e0-087e-40f4-904d-771804d9c02a");
        var coldZoneId = Guid.Parse("f2e96440-1996-4e5b-9d41-3b7c0604b087");
        var fixedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var warehouse = new Warehouse
        {
            Id = warehouseId,
            Name = "Kho Tổng Thông Minh - SmartWMS Center",
            Address = "Khu Công Nghệ Cao, TP. Thủ Đức",
            CreatedAt = fixedDate,
            CreatedBy = "SystemAdmin"
        };
        context.Warehouses.Add(warehouse);

        context.Zones.AddRange(
            new Zone { Id = dryZoneId, Code = "DRY", Name = "Khu Khô (Dry Zone)", WarehouseId = warehouseId, CreatedAt = fixedDate, CreatedBy = "SystemAdmin" },
            new Zone { Id = coldZoneId, Code = "COLD", Name = "Khu Mát (Cold Zone)", WarehouseId = warehouseId, CreatedAt = fixedDate, CreatedBy = "SystemAdmin" }
        );

        for (int i = 1; i <= 5; i++)
        {
            context.Bins.Add(new Bin
            {
                Id = Guid.Parse($"c1000000-0000-0000-0000-00000000000{i}"),
                Code = $"C-Z1-R{i}-L1",
                ZoneId = coldZoneId,
                MaxCapacity = 100,
                CurrentOccupancy = 0,
                CreatedAt = fixedDate,
                CreatedBy = "SystemAdmin"
            });

            context.Bins.Add(new Bin
            {
                Id = Guid.Parse($"d2000000-0000-0000-0000-00000000000{i}"),
                Code = $"D-Z2-R{i}-L1",
                ZoneId = dryZoneId,
                MaxCapacity = 500,
                CurrentOccupancy = 0,
                CreatedAt = fixedDate,
                CreatedBy = "SystemAdmin"
            });
        }

        await context.SaveChangesAsync();
    }
}
