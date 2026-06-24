using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Commands.ScheduleAutoCycleCount.Dtos; // Import namespace chứa DTO vừa tách biệt

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ScheduleAutoCycleCount;

public class ScheduleAutoCycleCountCommand : IRequest<Result<CycleCountSummaryDto>>
{
    // Tham số ngưỡng: Ô kệ có số lần xuất nhập vượt quá con số này trong tuần sẽ bị đưa vào diện kiểm kê gấp
    public int TransactionThreshold { get; set; } = 30;
}