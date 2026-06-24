using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class Customer : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DeliveryAddress { get; set; } = string.Empty;
}