using SmartWMS.Domain.Common;
using SmartWMS.Domain.Enums;
using System;
using System.ComponentModel.DataAnnotations; // BỔ SUNG: Để sử dụng thuộc tính [Timestamp]

namespace SmartWMS.Domain.Entities;

public class BinInventory : BaseEntity
{
    public Guid BinId { get; set; }
    public Bin Bin { get; set; } = null!;

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    // 🌟 THỐNG NHẤT KHÁI NIỆM: Giữ lại LotNumber làm đại diện duy nhất cho Số lô hàng
    public string LotNumber { get; set; } = string.Empty;

    // 🌟 THỐNG NHẤT KHÁI NIỆM: Giữ lại ExpirationDate làm đại diện duy nhất cho Hạn sử dụng
    public DateTime? ExpirationDate { get; set; }

    public int Quantity { get; set; }

    // 🌟 TỐI ƯU KIẾN TRÚC: Ép tuân thủ Enum InventoryStatus (Available, Blocked, Damaged...) 
    // Loại bỏ hoàn toàn trường chuỗi thô StockStatus để sạch DB
    public InventoryStatus Status { get; set; }

    // Mã kiện/Pallet hàng hóa (License Plate Number) - Quản lý kho thông minh bắt buộc phải có
    public string? LpnCode { get; set; }

    // 🌟 KÍCH HOẠT LÁ CHẮN TRANH CHẤP (Optimistic Concurrency Token)
    // Thêm [Timestamp] để EF Core tự dịch thành cột 'rowversion' trên SQL Server, 
    // Tự động kiểm soát tranh chấp thời gian thực khi 2 công nhân cùng bốc một ô kệ.
    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;
}