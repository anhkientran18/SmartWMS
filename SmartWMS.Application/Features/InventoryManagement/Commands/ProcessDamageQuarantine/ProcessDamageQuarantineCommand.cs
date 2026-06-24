using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ProcessDamageQuarantine;

public class ProcessDamageQuarantineCommand : IRequest<Result<bool>>
{
    public Guid BinId { get; set; } // Ô kệ phát hiện có hàng lỗi
    public Guid ProductId { get; set; } // Mã sản phẩm bị hỏng
    public string BatchNumber { get; set; } = string.Empty; // Số lô hàng
    public int QuarantineQuantity { get; set; } // Số lượng sản phẩm bị lỗi cần khóa
    public string DamageReason { get; set; } = string.Empty; // Lý do hỏng (AI phân tích hoặc Staff nhập)
}