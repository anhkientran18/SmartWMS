using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class Product : BaseEntity
{
    public string SKU { get; set; } = string.Empty;
public string Barcode { get; set; } = string.Empty;
public string Name { get; set; } = string.Empty;
public string? Unit { get; set; }
public string? Description { get; set; }
}