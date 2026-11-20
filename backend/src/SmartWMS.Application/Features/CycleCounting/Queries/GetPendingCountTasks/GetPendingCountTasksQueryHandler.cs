using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;

public class GetPendingCountTasksQueryHandler : IRequestHandler<GetPendingCountTasksQuery, Result<List<CycleCountTaskDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetPendingCountTasksQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<Result<List<CycleCountTaskDto>>> Handle(GetPendingCountTasksQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
            return Result<List<CycleCountTaskDto>>.Failure("Không xác định được nhân viên đang đăng nhập.");
        // 1. Truy vấn các phiếu kiểm kê chưa hoàn thành từ Database
        var pendingSheets = await _context.CycleCountSheets
            .AsNoTracking()
            .Include(s => s.Zone)
            .Include(s => s.Items).ThenInclude(i => i.Bin)
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .Where(s => !s.IsDeleted && s.AssignedUserId == userId &&
                (s.Status == "Pending" || s.Status == "Counting"))
            .ToListAsync(cancellationToken);

        var pendingTasks = new List<CycleCountTaskDto>();

        foreach (var sheet in pendingSheets)
        {
            foreach (var item in sheet.Items.Where(x => x.Status == "Pending"))
            {
                pendingTasks.Add(new CycleCountTaskDto
                {
                    CountSheetId = sheet.Id,
                    ItemId = item.Id,
                    SheetNumber = sheet.SheetNumber,
                    BinId = item.BinId,
                    BinCode = item.Bin?.Code ?? string.Empty,
                    LotNumber = item.LotNumber,
                    SystemQuantity = item.SystemQuantity,
                    ProductId = item.ProductId,
                    SKU = item.Product?.SKU ?? string.Empty,
                    ProductName = item.Product?.Name ?? string.Empty,
                    ABCClassification = item.Product?.Unit ?? "C",
                    ScheduledIntervalDays = 30,
                    TargetZone = sheet.Zone?.Name ?? "Khu vực chung",
                    PriorityMessage = $"Mã phiếu: {sheet.BatchCode} | Trạng thái: {sheet.Status}"
                });
            }
        }

        return Result<List<CycleCountTaskDto>>.Success(pendingTasks);
    }
}
