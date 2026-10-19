namespace SmartWMS.Application.Features.Zones.DTOs.Queries;

public class ZonePaginatedListQueryRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SearchKeyword { get; set; }
}