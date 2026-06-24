namespace SmartWMS.Application.Features.Products.Dtos;

public class ProductDto
{
    public Guid Id { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
}

public class ProductPaginationDto
{
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
    public List<ProductDto> Items { get; set; } = new();
}