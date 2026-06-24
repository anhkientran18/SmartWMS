using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveLpn;

public class MoveLpnCommand : IRequest<Result<bool>>
{
    public string LpnCode { get; set; } = string.Empty; // Mã Pallet/Mã kiện tổng (Ví dụ: PALLET-2026-001)
    public Guid ToBinId { get; set; } // Mã định danh ô kệ đích cần hạ kiện hàng xuống
}