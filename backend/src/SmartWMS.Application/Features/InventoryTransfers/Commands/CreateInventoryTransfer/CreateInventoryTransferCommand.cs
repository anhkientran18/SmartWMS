using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Commands.CreateInventoryTransfer;

public record CreateInventoryTransferCommand(CreateInventoryTransferRequest RequestData) : IRequest<Result<Guid>>;