namespace SmartWMS.Application.Features.Warehouses.Dtos;

public class WarehouseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty; // Thêm dòng này
    public string Address { get; set; } = string.Empty;
}