using SmartWMS.Domain.Common;
using System;

namespace SmartWMS.Domain.Entities;

public class Supplier : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;

    // 🌟 BỔ SUNG: Cờ phục vụ tính năng Xóa mềm (Soft Delete)
    public bool IsDeleted { get; set; } = false;
}