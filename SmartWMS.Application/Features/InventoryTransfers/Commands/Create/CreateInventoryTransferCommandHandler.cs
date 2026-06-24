using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.Commands.Create;

namespace SmartWMS.Application.Features.InventoryTransfers.Commands;

public class CreateInventoryTransferCommandHandler : IRequestHandler<CreateInventoryTransferCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly IInventoryNotificationService _notificationService;

    public CreateInventoryTransferCommandHandler(IApplicationDbContext context, IInventoryNotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<Result<bool>> Handle(CreateInventoryTransferCommand request, CancellationToken cancellationToken)
    {
        // 2. Kiểm tra Sản phẩm
        var product = await _context.Products.FirstOrDefaultAsync(p => p.SKU == request.SKU, cancellationToken);
        if (product == null)
            return Result<bool>.Failure("Không tìm thấy mã SKU sản phẩm trong hệ thống.");

        // 3. Lấy thông tin 2 ô kệ cùng lúc
        var sourceBin = await _context.Bins.FirstOrDefaultAsync(b => b.Id == request.SourceBinId, cancellationToken);
        var destBin = await _context.Bins.FirstOrDefaultAsync(b => b.Id == request.DestinationBinId, cancellationToken);

        if (sourceBin == null) return Result<bool>.Failure("Không tìm thấy ô kệ gốc.");
        if (destBin == null) return Result<bool>.Failure("Không tìm thấy ô kệ đích.");

        // 4. Kiểm tra logic tồn kho và sức chứa
        if (sourceBin.CurrentOccupancy < request.Quantity)
            return Result<bool>.Failure($"Kệ gốc [{sourceBin.Code}] không đủ số lượng để chuyển. Hiện có: {sourceBin.CurrentOccupancy}.");

        if (destBin.CurrentOccupancy + request.Quantity > destBin.MaxCapacity)
            return Result<bool>.Failure($"Kệ đích [{destBin.Code}] không đủ sức chứa. Chỉ còn trống: {destBin.MaxCapacity - destBin.CurrentOccupancy}.");

        // 5. Thực hiện luân chuyển
        sourceBin.CurrentOccupancy -= request.Quantity;
        destBin.CurrentOccupancy += request.Quantity;

        // Lưu dữ liệu (Hệ thống Audit Log sẽ tự động ghi nhận 2 hành động Update này)
        await _context.SaveChangesAsync(cancellationToken);

        // 6. Bắn thông báo Real-time cho màn hình giám sát kho
        await _notificationService.SendInventoryUpdateAsync(new InventoryUpdateModel
        {
            ProductId = product.Id,
            ProductName = product.Name,
            Quantity = (decimal)(-request.Quantity), // Ép kiểu tại đây
            Action = "LUÂN CHUYỂN (XUẤT)",
            Timestamp = DateTime.UtcNow,
            Message = $"Đã xuất {request.Quantity} từ kệ {sourceBin.Code}"
        });

        await _notificationService.SendInventoryUpdateAsync(new InventoryUpdateModel
        {
            ProductId = product.Id,
            ProductName = product.Name,
            Quantity = (decimal)request.Quantity, // Ép kiểu tại đây
            Action = "LUÂN CHUYỂN (NHẬP)",
            Timestamp = DateTime.UtcNow,
            Message = $"Đã nhập {request.Quantity} vào kệ {destBin.Code}"
        });

        return Result<bool>.Success(true, $"Luân chuyển thành công {request.Quantity} kiện từ {sourceBin.Code} sang {destBin.Code}.");
    }
}