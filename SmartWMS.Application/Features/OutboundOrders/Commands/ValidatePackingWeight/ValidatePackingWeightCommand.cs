using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight.Dtos;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;

public class ValidatePackingWeightCommand : IRequest<Result<WeightValidationResultDto>>
{
    public string SKU { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public double ActualWeightGrams { get; set; }

    // Mã định danh đơn hàng xuất kho cần kiểm thử đóng gói
    public Guid OrderId { get; set; }

    // Trọng lượng thực tế đo được từ cân điện tử chặng cuối (Kiểu decimal hỗ trợ tính chính xác cao)
    public decimal ActualWeight { get; set; }
}