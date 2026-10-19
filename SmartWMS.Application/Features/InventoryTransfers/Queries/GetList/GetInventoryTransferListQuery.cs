using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetList;

public record GetInventoryTransferListQuery(InventoryTransferListQueryRequest RequestData) : IRequest<Result<List<InventoryTransferDto>>>;