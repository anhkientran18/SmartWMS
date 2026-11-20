using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;

public record ChangeStockStatusCommand(ChangeStockStatusRequest RequestData) : IRequest<Result<bool>>;