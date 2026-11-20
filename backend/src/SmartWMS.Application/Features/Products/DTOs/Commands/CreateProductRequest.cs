namespace SmartWMS.Application.Features.Products.DTOs.Commands;

public class CreateProductRequest
{
    public SmartWMS.Domain.Enums.ProductTrackingMode TrackingMode { get; set; } = SmartWMS.Domain.Enums.ProductTrackingMode.None;
    public string SKU { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Unit { get; set; } = "Pcs";
    public double Width { get; set; }
    public double Height { get; set; }
    public double Depth { get; set; }
}