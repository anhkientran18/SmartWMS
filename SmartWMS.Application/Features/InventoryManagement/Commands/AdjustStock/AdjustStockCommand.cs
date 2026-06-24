using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;

public class AdjustStockCommand : IRequest<Result<Guid>>
{
    public Guid BinId { get; set; }
    public Guid ProductId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public int NewQuantity { get; set; } // Số lượng đếm thực tế mới tại ô kệ
    public string ReasonCode { get; set; } = string.Empty; // DAMAGED, LOST, FOUND, CYCLING_DISCREPANCY
    // ============================================================================
    // 🌟 ĐÃ BỔ SUNG: Số lượng điều chỉnh và Lý do ghi nhận kiểm toán (Audit Trail)
    // Giá trị này có thể âm (khi xuất hủy/hao hụt) hoặc dương (khi kiểm kho thừa)
    // ============================================================================
    public int Quantity { get; set; }

    public string Reason { get; set; } = string.Empty;
}