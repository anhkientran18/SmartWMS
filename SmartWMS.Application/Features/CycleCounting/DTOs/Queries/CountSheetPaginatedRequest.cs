namespace SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

public class CountSheetPaginatedRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Status { get; set; }
    public string? SearchKeyword { get; set; }
}