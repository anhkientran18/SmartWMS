using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ConfirmCycleCount;

public class ConfirmCycleCountCommand : IRequest<Result<bool>>
{
    public Guid BinId { get; set; }
    public Guid ProductId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public int PhysicalQuantity { get; set; } // Số lượng thực tế công nhân đếm được tại ô kệ
}