using System;

namespace SmartWMS.Application.Features.Products.Queries.GetSemanticProducts.Models;

public class ProductVectorCacheModel
{
    public Guid Id { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public float[] Embedding { get; set; } = Array.Empty<float>(); // Mảng float[] đã được giải mã sẵn trên RAM
}