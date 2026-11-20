using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AutoReplenish;

public class AutoReplenishCommand : IRequest<Result<int>>
{
    // Lệnh quét diện rộng tự động tính toán, không cần tham số thô từ client
}