using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;

public class ChangeStockStatusCommand : IRequest<Result<Guid>>
{
    public Guid BinId { get; set; }
    public Guid ProductId { get; set; }
    public string LotNumber { get; set; } = string.Empty;

    // Định mức trạng thái: 1 - Available, 2 - Quarantine, 3 - Blocked, 4 - Damaged
    public int NewStatus { get; set; }
    public string Reason { get; set; } = string.Empty;
}