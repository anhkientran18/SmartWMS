namespace SmartWMS.Application.Features.Warehouses.DTOs.Queries;

public class WarehousePaginatedListQueryRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SearchKeyword { get; set; }
}