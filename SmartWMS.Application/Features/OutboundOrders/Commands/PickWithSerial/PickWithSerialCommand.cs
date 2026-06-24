using MediatR;
using SmartWMS.Application.Common.Models;
using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;

public class PickWithSerialCommand : IRequest<Result<List<string>>>
{
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public Guid ProductId { get; set; }
    // 🌟 ĐÃ BỔ SUNG: Ô kệ chứa hàng và Số định danh Serial của sản phẩm
    public Guid BinId { get; set; }
    public string SerialNumber { get; set; } = string.Empty;
    public List<string> ScannedSerials { get; set; } = new(); // Tập hợp mã Serial do công nhân quét thực tế từ thiết bị PDA
}