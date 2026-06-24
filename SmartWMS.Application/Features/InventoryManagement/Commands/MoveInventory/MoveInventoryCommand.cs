using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveInventory;

public class MoveInventoryCommand : IRequest<Result<bool>>
{
    public Guid FromBinId { get; set; }        // ID ô kệ nguồn bốc hàng đi
    public Guid ToBinId { get; set; }          // ID ô kệ đích hạ hàng xuống
    public Guid ProductId { get; set; }        // ID sản phẩm cần dịch chuyển
    public string LotNumber { get; set; } = string.Empty; // Số lô sản xuất (Nếu DB của bạn dùng trường LotNumber thì đổi tên tương ứng nhé)
    public int MoveQuantity { get; set; }      // Số lượng hàng dịch chuyển
}