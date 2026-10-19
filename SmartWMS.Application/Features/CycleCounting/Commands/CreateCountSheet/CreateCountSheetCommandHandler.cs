using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;

public class CreateCountSheetCommandHandler : IRequestHandler<CreateCountSheetCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateCountSheetCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateCountSheetCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var inventoryRepo = _unitOfWork.Repository<BinInventory>();
        var countSheetRepo = _unitOfWork.Repository<CycleCountSheet>(); // Tạm giả định Entity của bạn tên là CycleCountSheet

        // 1. Kéo tồn kho thực tế hiện tại theo Khu vực / Ô kệ
        var spec = new BinInventoryForCountSheetSpec(req.ZoneId, req.BinId);
        var inventoriesToCount = await inventoryRepo.ListAsync(spec, cancellationToken);

        if (!inventoriesToCount.Any())
        {
            return Result<Guid>.Failure("Không có tồn kho nào được ghi nhận tại vị trí này để thực hiện kiểm kê.");
        }

        if (inventoriesToCount.GroupBy(x => new { x.BinId, x.ProductId, x.LotNumber }).Any(g => g.Count() > 1))
            return Result<Guid>.Failure(ErrorCodeConstants.Conflict,
                "Không thể lập snapshot duy nhất: có nhiều status tồn cho cùng Bin/Product/Lot; model kiểm kê chưa lưu status.");

        // 2. Khởi tạo Header Phiếu kiểm kê
        var countSheet = new CycleCountSheet
        {
            Id = Guid.NewGuid(),
            SheetNumber = $"CC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 5).ToUpper()}",
            ZoneId = req.ZoneId,
            BinId = req.BinId,
            AssignedUserId = req.AssignedUserId,
            Status = "Pending", // Pending, Counting, Completed, Cancelled
            Notes = req.Notes,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "WarehouseManager",
            Items = new List<CycleCountItem>()
        };

        // 3. Khởi tạo danh sách Line Items (Snapshots tồn kho hiện tại)
        foreach (var inv in inventoriesToCount)
        {
            countSheet.Items.Add(new CycleCountItem
            {
                Id = Guid.NewGuid(),
                CountSheetId = countSheet.Id,
                BinId = inv.BinId,
                ProductId = inv.ProductId,
                LotNumber = inv.LotNumber,
                SystemQuantity = inv.Quantity, // Chốt số lượng hệ thống tại thời điểm tạo phiếu
                CountedQuantity = 0, // Chờ nhân viên điền
                Status = "Pending"
            });
        }

        // 4. Lưu giao dịch
        await countSheetRepo.AddAsync(countSheet, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(countSheet.Id, $"Đã tạo phiếu kiểm kê {countSheet.SheetNumber} với {countSheet.Items.Count} dòng mặt hàng cần đếm.");
    }
}