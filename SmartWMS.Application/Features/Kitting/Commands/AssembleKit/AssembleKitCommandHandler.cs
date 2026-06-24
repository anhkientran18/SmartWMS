using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Kitting.Commands.AssembleKit.Dtos;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit;

public class AssembleKitCommandHandler : IRequestHandler<AssembleKitCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;

    public AssembleKitCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<Guid>> Handle(AssembleKitCommand request, CancellationToken cancellationToken)
    {
        if (request.QuantityToBuild <= 0)
        {
            return Result<Guid>.Failure("Số lượng Combo cần đóng bộ phải lớn hơn 0.");
        }

        // 1. KIỂM TRA NĂNG LỰC ĐÁP ỨNG: Quét kiểm tra toàn diện số lượng linh kiện có đủ trong kho hay không
        foreach (var component in request.Components)
        {
            int totalRequired = component.QuantityPerKit * request.QuantityToBuild;
            int currentStock = await _context.BinInventories
                .Where(x => x.ProductId == component.ProductId && x.Status == InventoryStatus.Available)
                .SumAsync(x => x.Quantity, cancellationToken);

            if (currentStock < totalRequired)
            {
                return Result<Guid>.Failure($"Hành động bị hủy bỏ. Không đủ linh kiện lẻ trong kho. Cần {totalRequired} đơn vị nhưng hiện tại chỉ còn {currentStock}.");
            }
        }

        // 2. KHẤU TRỪ LINH KIỆN ĐƠN LẺ KHỎI CÁC Ô KỆ CŨ
        foreach (var component in request.Components)
        {
            int remainingToDeduct = component.QuantityPerKit * request.QuantityToBuild;
            var stocks = await _context.BinInventories
                .Include(x => x.Bin)
                .Where(x => x.ProductId == component.ProductId && x.Status == InventoryStatus.Available)
                .ToListAsync(cancellationToken);

            foreach (var stock in stocks)
            {
                if (remainingToDeduct <= 0) break;

                int deductQty = Math.Min(stock.Quantity, remainingToDeduct);
                stock.Quantity -= deductQty;
                if (stock.Bin != null) stock.Bin.CurrentOccupancy -= deductQty;

                if (stock.Quantity == 0) _context.BinInventories.Remove(stock);

                // Ghi nhận lịch sử giải phóng linh kiện đưa vào khu vực đóng bộ
                _context.InventoryTransactions.Add(new InventoryTransaction
                {
                    Id = Guid.NewGuid(),
                    ProductId = component.ProductId,
                    TransactionType = "KIT_DECOMPONENT",
                    QuantityChanged = -deductQty,
                    SourceBinCode = stock.Bin?.Code ?? "UNKNOWN",
                    DestinationBinCode = "KIT_ASSEMBLY_ZONE",
                    ReasonCode = "KITTING_PROCESS_CONSUME",
                    CreatedBy = "Kitting_Engine",
                    CreatedAt = DateTime.UtcNow
                });

                remainingToDeduct -= deductQty;
            }
        }

        // 3. KHỞI TẠO TĂNG SỐ DƯ TỒN KHO CHO MÃ SKU COMBO MỚI TẠI KHU VỰC TIỀN PHƯƠNG
        var assemblyBin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Code == "KIT_ASSEMBLY_ZONE", cancellationToken);

        if (assemblyBin == null)
        {
            // Dự phòng tạo nhanh ô kệ ảo đóng bộ nếu hệ thống chưa có dữ liệu mồi
            assemblyBin = new Bin
            {
                Id = Guid.NewGuid(),
                Code = "KIT_ASSEMBLY_ZONE",
                MaxCapacity = 9999,
                CurrentOccupancy = 0,
                CreatedBy = "SystemAdmin",
                CreatedAt = DateTime.UtcNow
            };
            _context.Bins.Add(assemblyBin);
        }

        var newComboStock = new BinInventory
        {
            Id = Guid.NewGuid(),
            BinId = assemblyBin.Id,
            ProductId = request.ComboProductId,
            Quantity = request.QuantityToBuild,
            LotNumber = $"KIT-{DateTime.Now:yyyyMMdd}",
            ExpirationDate = DateTime.UtcNow.AddDays(180),
            Status = InventoryStatus.Available
        };
        _context.BinInventories.Add(newComboStock);
        assemblyBin.CurrentOccupancy += request.QuantityToBuild;

        // Ghi nhận lịch sử tăng sản phẩm Combo thành phẩm vào sổ cái kho
        _context.InventoryTransactions.Add(new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = request.ComboProductId,
            TransactionType = "KIT_PRODUCTION",
            QuantityChanged = request.QuantityToBuild,
            SourceBinCode = "KIT_ASSEMBLY_ZONE",
            DestinationBinCode = "KIT_ASSEMBLY_ZONE",
            ReasonCode = "COMBO_ASSEMBLED_SUCCESS",
            CreatedBy = "Kitting_Engine",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        return Result<Guid>.Success(newComboStock.Id, $"Đóng bộ Combo thành công! Đã giải phóng linh kiện lẻ và nạp {request.QuantityToBuild} sản phẩm Combo mới vào khu vực KIT_ASSEMBLY_ZONE.");
    }
}