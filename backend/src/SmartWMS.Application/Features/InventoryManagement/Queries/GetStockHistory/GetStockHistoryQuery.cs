using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;

public record GetStockHistoryQuery(StockHistoryPaginatedRequest RequestData) : IRequest<Result<PaginatedResult<StockHistoryDto>>>;