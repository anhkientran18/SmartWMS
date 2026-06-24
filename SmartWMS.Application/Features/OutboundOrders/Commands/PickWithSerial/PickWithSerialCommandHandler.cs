using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;

public class PickWithSerialCommandHandler : IRequestHandler<PickWithSerialCommand, Result<List<string>>>
{
    private readonly IApplicationDbContext _context;

    public PickWithSerialCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<string>>> Handle(PickWithSerialCommand request, CancellationToken cancellationToken)
    {
        if (request.ScannedSerials == null || !request.ScannedSerials.Any())
        {
            return Result<List<string>>.Failure("Yêu cầu bị từ chối. Phải quét tối thiểu một mã Serial/IMEI để xuất kho.");
        }

        // 1. Quét đối chiếu danh sách Serial trong kho máy chủ
        var serialsInDb = await _context.ProductSerialNumbers
            .Where(s => s.ProductId == request.ProductId && request.ScannedSerials.Contains(s.SerialCode))
            .ToListAsync(cancellationToken);

        // Phát hiện mã Serial lạ hoặc đã bị xuất bán trước đó
        var invalidSerials = request.ScannedSerials
            .Except(serialsInDb.Where(s => s.Status == "InStock").Select(s => s.SerialCode))
            .ToList();

        if (invalidSerials.Any())
        {
            return Result<List<string>>.Failure($"Từ chối xuất kho. Phát hiện mã Serial không hợp lệ hoặc đã rời kho: {string.Join(", ", invalidSerials)}");
        }

        // 2. Chuyển đổi trạng thái đóng băng Serial phục vụ bảo hành hành trình
        foreach (var serial in serialsInDb)
        {
            serial.Status = "Allocated";
            serial.OutboundOrderCode = request.OrderCode;

            // Hạ cấp số dư tồn kho tổng tại ô kệ chứa thiết bị đó
            if (serial.BinInventoryId.HasValue)
            {
                var binInventory = await _context.BinInventories
                    .Include(x => x.Bin)
                    .FirstOrDefaultAsync(x => x.Id == serial.BinInventoryId, cancellationToken);

                if (binInventory != null)
                {
                    binInventory.Quantity -= 1;
                    if (binInventory.Bin != null)
                    {
                        binInventory.Bin.CurrentOccupancy -= 1;
                    }

                    if (binInventory.Quantity <= 0)
                    {
                        _context.BinInventories.Remove(binInventory);
                    }

                    // Ghi sổ cái giao dịch biến động kho tổng
                    _context.InventoryTransactions.Add(new InventoryTransaction
                    {
                        Id = Guid.NewGuid(),
                        ProductId = request.ProductId,
                        TransactionType = "OUTBOUND_SERIAL",
                        QuantityChanged = -1,
                        SourceBinCode = binInventory.Bin?.Code ?? "UNKNOWN",
                        DestinationBinCode = "SHIPPING_DOCK",
                        ReasonCode = $"SERIAL_PICKED_{serial.SerialCode}",
                        CreatedBy = "Serial_Scanner",
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return Result<List<string>>.Success(request.ScannedSerials, $"Đã xác thực và giữ chỗ thành công {request.ScannedSerials.Count} mã Serial cho đơn hàng {request.OrderCode}.");
    }
}