using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Localization;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.Create;

public class CreateInboundReceiptCommandHandler : IRequestHandler<CreateInboundReceiptCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly IInventoryNotificationService _notificationService;

    public CreateInboundReceiptCommandHandler(IApplicationDbContext context, IStringLocalizer<SharedResource> localizer, IInventoryNotificationService notificationService)
    {
        _context = context;
        _localizer = localizer;
        _notificationService = notificationService;
    }

    public async Task<Result<Guid>> Handle(CreateInboundReceiptCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra SKU sản phẩm tồn tại trong danh mục
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.SKU == request.SKU, cancellationToken);

        if (product == null)
            return Result<Guid>.Failure(_localizer["Product_NotFound"]);

        // 2. Kiểm tra ô kệ chỉ định và sức chứa (Capacity Check)
        var bin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.BinId, cancellationToken);

        if (bin == null)
            return Result<Guid>.Failure(_localizer["Bin_NotFound"]);

        if (bin.CurrentOccupancy + request.Quantity > bin.MaxCapacity)
            return Result<Guid>.Failure(_localizer["Bin_OverCapacity"]);

        // ============================================================================
        // 🌟 ĐÃ SỬA: Khởi tạo thực thể InboundReceipt theo mô hình quan hệ 1-N mới
        // Đóng gói thông tin sản phẩm và số lượng vào danh sách chi tiết Items con
        // ============================================================================
        var receipt = new InboundReceipt
        {
            Id = Guid.NewGuid(),
            BinId = bin.Id,
            SupplierId = null, // Có thể gán từ request nếu Command của bạn có mở rộng trường này
            Items = new List<InboundReceiptItem>
            {
                new InboundReceiptItem
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    QuantityExpected = request.Quantity, // Số lượng trên chứng từ đặt hàng
                    QuantityReceived = request.Quantity, // Số lượng thực tế hạ hàng vào ô kệ
                    LotNumber = "LOT-DEFAULT"
                }
            }
        };

        _context.InboundReceipts.Add(receipt);

        // 4. Cập nhật không gian lấp đầy tại ô kệ
        bin.CurrentOccupancy += request.Quantity;

        await _context.SaveChangesAsync(cancellationToken);

        // ============================================================================
        // 🌟 ĐÃ SỬA: Gửi thông báo Real-time trỏ trực tiếp từ dữ liệu product và request
        // ============================================================================
        await _notificationService.SendInventoryUpdateAsync(new InventoryUpdateModel
        {
            ProductId = product.Id,
            ProductName = product.Name,
            Quantity = request.Quantity,
            Action = "INBOUND",
            Timestamp = DateTime.UtcNow
        });

        return Result<Guid>.Success(receipt.Id, _localizer["Inbound_Success"]);
    }
}