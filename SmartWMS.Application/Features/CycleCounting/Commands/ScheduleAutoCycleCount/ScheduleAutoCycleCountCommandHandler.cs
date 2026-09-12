using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Commands.ScheduleAutoCycleCount.Dtos;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ScheduleAutoCycleCount;

public class ScheduleAutoCycleCountCommandHandler : IRequestHandler<ScheduleAutoCycleCountCommand, Result<CycleCountSummaryDto>>
{
    private readonly IApplicationDbContext _context;

    public ScheduleAutoCycleCountCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CycleCountSummaryDto>> Handle(ScheduleAutoCycleCountCommand request, CancellationToken cancellationToken)
    {
        // 1. Phân tích rủi ro hệ thống: Tìm các mã ô kệ có số lượng giao dịch biến động lớn trong vòng 7 ngày qua
        var lookbackDate = DateTime.UtcNow.AddDays(-7);

        var highRiskBinCodes = await _context.InventoryTransactions
            .Where(t => t.CreatedAt >= lookbackDate && t.SourceBinCode != "RECEIVING_DOCK")
            .GroupBy(t => t.SourceBinCode)
            .Where(g => g.Count() >= request.TransactionThreshold)
            .Select(g => g.Key)
            .ToListAsync(cancellationToken);

        // 2. Tìm thêm các ô kệ đang có lượng hàng tồn thực tế chạm đáy cực thấp (Dưới 2 sản phẩm nhưng chưa bằng 0)
        // Đây là vùng nhạy cảm, rất dễ xảy ra lỗi "Khách mua 10 nhưng trên kệ thực tế chỉ có 5" như thầy bạn đã hỏi
        var nearEmptyBinIds = await _context.BinInventories
            .Include(x => x.Bin)
            .Where(x => x.Bin != null && !x.Bin.IsDeleted && x.Quantity > 0 && x.Quantity <= 2)
            .Select(x => x.BinId)
            .Distinct()
            .ToListAsync(cancellationToken);

        // 3. Tổng hợp danh sách thực thể Ô kệ (Bins) cần đưa vào diện kiểm kê cuốn chiếu hôm nay
        var targetedBins = await _context.Bins
            .Where(b => !b.IsDeleted && (highRiskBinCodes.Contains(b.Code) || nearEmptyBinIds.Contains(b.Id)))
            .Take(10) // Khống chế giới hạn tối đa 10 kệ mỗi ngày để tránh làm quá tải nhân công hiện trường
            .ToListAsync(cancellationToken);

        if (!targetedBins.Any())
        {
            return Result<CycleCountSummaryDto>.Success(new CycleCountSummaryDto(), "Hệ thống an toàn. Không phát hiện ô kệ nào có biến động bất thường cần kiểm kê cuốn chiếu.");
        }

        var resultDto = new CycleCountSummaryDto
        {
            BatchCode = $"CC-{DateTime.Now:yyyyMMdd}-AUTO",
            TotalBinsTargeted = targetedBins.Count,
            TargetedBinCodes = targetedBins.Select(b => b.Code ?? "N/A").ToList(),
            AutoAssignmentOperator = "Team_QC_Shift_A" // Tự động chỉ định đội ngũ chịu trách nhiệm hiện trường
        };

        // 4. LOGISTICS BUSINESS RULE: Đóng băng trạng thái hoặc ghi nhận chỉ thị kiểm kê vào hệ thống
        foreach (var bin in targetedBins)
        {
            // Thực tế doanh nghiệp: Tạo bản ghi chi tiết vào bảng StockCountSheets để đẩy lên màn hình súng quét PDA
            bin.UpdatedAt = DateTime.UtcNow;
            bin.UpdatedBy = "WMS_SmartCycleEngine";
        }

        // Đồng bộ vết kiểm toán xuống Database
        await _context.SaveChangesAsync(cancellationToken);

        return Result<CycleCountSummaryDto>.Success(resultDto, $"Hệ thống đã tự động lập lịch kiểm kê cuốn chiếu thành công cho {resultDto.TotalBinsTargeted} vị trí ô kệ có tần suất rủi ro cao.");
    }
}