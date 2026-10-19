using SmartWMS.Domain.Common;
using System;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class Product : BaseEntity
{
    public string SKU { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
    public string? DescriptionEmbeddingJson { get; set; }
    public double Weight { get; set; } // Trọng lượng chuẩn phục vụ kiểm tra Packing
    public string ABCClass { get; set; } = "C"; // Phân loại mặt hàng A, B, hoặc C

    // 🌟 BỔ SUNG: Cờ phục vụ tính năng Xóa mềm (Soft Delete)
    public bool IsDeleted { get; set; } = false;

    public ICollection<BinInventory> BinInventories { get; set; } = new List<BinInventory>();
}