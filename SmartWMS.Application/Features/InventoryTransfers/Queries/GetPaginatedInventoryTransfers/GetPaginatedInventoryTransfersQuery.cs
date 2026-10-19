using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetPaginatedInventoryTransfers;

public record GetPaginatedInventoryTransfersQuery(InventoryTransferPaginatedQueryRequest RequestData)
    : IRequest<Result<PaginatedResult<InventoryTransferDto>>>;