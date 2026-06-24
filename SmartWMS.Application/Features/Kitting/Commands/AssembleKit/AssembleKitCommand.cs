using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Kitting.Commands.AssembleKit.Dtos; // Import namespace chứa DTO vừa tách biệt
using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit;

public class AssembleKitCommand : IRequest<Result<Guid>>
{
    // Mã định danh sản phẩm đích của bộ Combo/Kit tổng hợp
    public Guid ComboProductId { get; set; }

    // Số lượng thành phẩm Combo mong muốn đóng gói/lắp ráp ngoài hiện trường
    public int QuantityToBuild { get; set; }

    // Danh sách các linh kiện vật lý thành phần cấu thành bắt buộc phải khấu trừ kho
    public List<KitComponentDto> Components { get; set; } = new();
}