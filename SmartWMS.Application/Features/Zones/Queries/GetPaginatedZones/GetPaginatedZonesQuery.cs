using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Dtos;

namespace SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;

public record GetPaginatedZonesQuery(
    Guid? WarehouseId = null, // Lọc theo Kho (tùy chọn)
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchKeyword = null) : IRequest<Result<ZonePaginationDto>>;

public class ZonePaginationDto
{
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
    public List<ZoneDto> Items { get; set; } = new();
}