using System;
namespace SmartWMS.Application.Features.Warehouses.DTOs;

public class WarehouseDto
{
    public Guid? DefaultStagingBinId { get; set; }
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}