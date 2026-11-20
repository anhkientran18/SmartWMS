using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetById;

public record GetInventoryTransferByIdQuery(InventoryTransferByIdRequest RequestData) : IRequest<Result<InventoryTransferDto>>;