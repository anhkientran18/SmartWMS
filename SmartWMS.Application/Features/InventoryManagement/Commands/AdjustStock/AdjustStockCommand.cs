using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;

public record AdjustStockCommand(AdjustStockRequest RequestData) : IRequest<Result<bool>>;