namespace SmartWMS.Application.Features.Products.DTOs.Queries;

public class ProductPaginatedListQueryRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SearchKeyword { get; set; }
}