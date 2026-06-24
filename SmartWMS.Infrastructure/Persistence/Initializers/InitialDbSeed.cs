using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext; // BỔ SUNG: Để sử dụng concrete class ApplicationDbContext
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Persistence.Initializers;

// ============================================================================
// Lớp cấu hình gieo dữ liệu mẫu thông minh kết hợp tự động nhúng AI Vector
// ============================================================================
public static class InitialDbSeed
{
    // SỬA ĐỔI: Thay thế IApplicationDbContext bằng ApplicationDbContext để lấy quyền gọi .Database
    public static async Task SeedDataAsync(ApplicationDbContext context, IEmbeddingService embeddingService)
    {
        // 1. Thực thi Tự động cập nhật các bản chỉnh sửa cấu trúc bảng (Migration) nếu chưa khớp DB
        if (context.Database.IsSqlServer())
        {
            await context.Database.MigrateAsync();
        }

        // 2. GIEO DỮ LIỆU DANH MỤC SẢN PHẨM MẪU CHUẨN KHO VẬN (MDM Products Seeding)
        if (!await context.Products.AnyAsync())
        {
            var sampleProducts = new List<Product>
            {
                new Product
                {
                    Id = Guid.NewGuid(),
                    SKU = "COCA-COOL-320",
                    Barcode = "893000001001",
                    Name = "Nước ngọt Coca Cola lon 320ml",
                    Unit = "Thùng",
                    Description = "Nước giải khát có ga, yêu cầu bảo quản phân khu mát mẻ lạnh để đảm bảo chất lượng ngon nhất."
                },
                new Product
                {
                    Id = Guid.NewGuid(),
                    SKU = "MILK-VINAMILK-1L",
                    Barcode = "893000001002",
                    Name = "Sữa tươi tiệt trùng Vinamilk 1L",
                    Unit = "Thùng",
                    Description = "Sữa tươi nguyên chất tiệt trùng, bắt buộc lưu kho khu mát lạnh (Cold Zone), tránh ánh nắng trực tiếp."
                },
                new Product
                {
                    Id = Guid.NewGuid(),
                    SKU = "LOGI-MOUSE-MX3",
                    Barcode = "893000001003",
                    Name = "Chuột không dây Logitech MX Master 3S",
                    Unit = "Hộp",
                    Description = "Thiết bị ngoại vi máy tính cao cấp, linh kiện điện tử nhạy cảm, yêu cầu lưu kho khu khô ráo, độ ẩm thấp."
                },
                new Product
                {
                    Id = Guid.NewGuid(),
                    SKU = "ASUS-ROGSTRIX-G16",
                    Barcode = "893000001004",
                    Name = "Laptop Gaming ASUS ROG Strix G16",
                    Unit = "Thùng",
                    Description = "Máy tính xách tay cấu hình cao, hàng điện tử giá trị lớn dễ vỡ, bảo quản nghiêm ngặt tại khu khô ráo chống ẩm."
                }
            };

            // Tiến hành số hóa đồng bộ chuỗi mô tả thành AI Vector ngay khi gieo dữ liệu
            foreach (var product in sampleProducts)
            {
                string textToEmbed = $"{product.Name ?? string.Empty} {product.Description ?? string.Empty}";

                // Gửi sang mô hình text-embedding-004 của Google Gemini
                float[] vector = await embeddingService.GenerateEmbeddingAsync(textToEmbed);

                if (vector != null && vector.Length > 0)
                {
                    product.DescriptionEmbeddingJson = JsonSerializer.Serialize(vector);
                }

                context.Products.Add(product);
            }

            // Lưu dữ liệu sạch xuống SQL Server
            await context.SaveChangesAsync(System.Threading.CancellationToken.None);
        }
        else
        {
            // KỊCH BẢN KHẨN CẤP (Backfill Logic): Nếu DB đã có hàng từ trước nhưng chưa có cột Vector AI,
            // hệ thống sẽ tự động quét và bổ sung cập nhật ngầm cho các sản phẩm còn thiếu.
            var missingEmbeddingProducts = await context.Products
                .Where(p => p.DescriptionEmbeddingJson == null || p.DescriptionEmbeddingJson == string.Empty)
                .ToListAsync();

            if (missingEmbeddingProducts.Any())
            {
                foreach (var product in missingEmbeddingProducts)
                {
                    string textToEmbed = $"{product.Name ?? string.Empty} {product.Description ?? string.Empty}";
                    float[] vector = await embeddingService.GenerateEmbeddingAsync(textToEmbed);

                    if (vector != null && vector.Length > 0)
                    {
                        product.DescriptionEmbeddingJson = JsonSerializer.Serialize(vector);
                    }
                }
                await context.SaveChangesAsync(System.Threading.CancellationToken.None);
            }
        }
    }
}