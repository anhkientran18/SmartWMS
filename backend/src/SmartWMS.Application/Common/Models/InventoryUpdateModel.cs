namespace SmartWMS.Application.Common.Models;

public class InventoryUpdateModel
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; } // Đảm bảo đây là decimal
    public string Action { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string Message { get; set; } = string.Empty; // Thêm thuộc tính này
}