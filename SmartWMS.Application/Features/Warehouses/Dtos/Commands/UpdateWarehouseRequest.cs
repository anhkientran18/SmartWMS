using System;

namespace SmartWMS.Application.Features.Warehouses.DTOs.Commands;

public class UpdateWarehouseRequest
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}