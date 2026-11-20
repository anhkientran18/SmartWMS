using System;

namespace SmartWMS.Application.Features.CycleCounting.DTOs.Commands;

public class CreateCountSheetRequest
{
    // Hỗ trợ kiểm kê theo Khu vực (Zone) hoặc chi tiết 1 Ô kệ (Bin)
    public Guid? ZoneId { get; set; }
    public Guid? BinId { get; set; }
    public string Notes { get; set; } = string.Empty;
    public Guid? AssignedUserId { get; set; } // Phân công cho nhân viên nào đi đếm
}