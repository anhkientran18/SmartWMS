using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Dtos;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;

public record GetPaginatedWarehousesQuery(int PageNumber = 1, int PageSize = 10, string? SearchKeyword = null)
    : IRequest<Result<WarehousePaginationDto>>;

public class WarehousePaginationDto
{
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
    public List<WarehouseDto> Items { get; set; } = new();
}