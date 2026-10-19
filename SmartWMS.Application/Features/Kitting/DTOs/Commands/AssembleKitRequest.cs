using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Kitting.DTOs.Commands;

public class AssembleKitRequest
{
    // Sản phẩm Combo (Kit) sẽ được tạo ra
    public Guid KitProductId { get; set; }
    public Guid TargetBinId { get; set; } // Kệ đích để cất Combo sau khi đóng gói
    public int AssembleQuantity { get; set; } // Số lượng Combo muốn tạo

    // Danh sách các sản phẩm thành phần bị trừ đi
    public List<KitComponentRequest> Components { get; set; } = new();
}

public class KitComponentRequest
{
    public Guid ComponentProductId { get; set; }
    public Guid SourceBinId { get; set; } // Lấy thành phần này từ kệ nào
    public int QuantityPerKit { get; set; } // Số lượng cần dùng cho MỘT Combo
}