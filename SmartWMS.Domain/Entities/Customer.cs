using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class Customer : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty; // Bổ sung trường Address
    public bool IsDeleted { get; set; } = false;
}