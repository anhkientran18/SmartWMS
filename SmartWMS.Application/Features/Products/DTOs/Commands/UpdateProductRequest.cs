using System;

namespace SmartWMS.Application.Features.Products.DTOs.Commands;

public class UpdateProductRequest
{
    public SmartWMS.Domain.Enums.ProductTrackingMode? TrackingMode { get; set; }
    public Guid Id { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Unit { get; set; } = "Cái";
}