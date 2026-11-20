using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.LockExpiredStock;

// Định nghĩa lệnh thực thi chạy ngầm hệ thống, trả về số lượng bản ghi bị tác động (int)
public class LockExpiredStockCommand : IRequest<Result<int>>
{
    // Lệnh quét tự động toàn kho diện rộng, không cần tham số đầu vào từ client
}