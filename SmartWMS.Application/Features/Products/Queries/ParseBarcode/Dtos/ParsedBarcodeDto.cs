using System;

namespace SmartWMS.Application.Features.Products.Queries.ParseBarcode.Dtos;

public class ParsedBarcodeDto
{
    public Guid ProductId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty;
    public DateTime? ExpirationDate { get; set; }
    public string StockStatus { get; set; } = "Available";
}