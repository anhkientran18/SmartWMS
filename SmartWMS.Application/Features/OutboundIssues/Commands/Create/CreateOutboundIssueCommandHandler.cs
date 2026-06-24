using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Localization;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundIssues.Commands.Create;

public class CreateOutboundIssueCommandHandler : IRequestHandler<CreateOutboundIssueCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly IInventoryNotificationService _notificationService;

    public CreateOutboundIssueCommandHandler(
        IApplicationDbContext context,
        IStringLocalizer<SharedResource> localizer,
        IInventoryNotificationService notificationService)
    {
        _context = context;
        _localizer = localizer;
        _notificationService = notificationService;
    }

    public async Task<Result<Guid>> Handle(CreateOutboundIssueCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra SKU có tồn tại không
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.SKU == request.SKU, cancellationToken);

        if (product == null)
            return Result<Guid>.Failure(_localizer["Product_NotFound"]);

        // 2. Lấy thông tin vị trí Bin
        var bin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.BinId, cancellationToken);

        if (bin == null)
            return Result<Guid>.Failure(_localizer["Bin_NotFound"]);

        // 3. Logic quan trọng: Kiểm tra xem Kệ có đủ hàng để xuất không
        if (bin.CurrentOccupancy < request.Quantity)
        {
            return Result<Guid>.Failure(_localizer["Insufficient_Stock"]);
        }

        // ============================================================================
        // 🌟 ĐÃ SỬA: Khởi tạo thực thể OutboundIssue theo cấu trúc quan hệ 1-N mới
        // Đóng gói thông tin sản phẩm và số lượng xuất vào bảng chi tiết con OutboundOrderItem
        // ============================================================================
        var issue = new OutboundIssue
        {
            Id = Guid.NewGuid(),
            BinId = bin.Id,
            CustomerId = null, // Có thể mở rộng gán từ request nếu Command sau này bổ sung Customer
            Items = new List<OutboundOrderItem>
            {
                new OutboundOrderItem
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    Quantity = request.Quantity
                }
            }
        };

        _context.OutboundIssues.Add(issue);

        // 4. Trừ số lượng không gian lấp đầy tại ô kệ
        bin.CurrentOccupancy -= request.Quantity;

        await _context.SaveChangesAsync(cancellationToken);

        // ============================================================================
        // 🌟 ĐÃ SỬA: Trỏ dữ liệu trực tiếp từ biến product và request để tránh lỗi compiler
        // ============================================================================
        await _notificationService.SendInventoryUpdateAsync(new InventoryUpdateModel
        {
            ProductId = product.Id,
            ProductName = product.Name,
            Quantity = (decimal)(-request.Quantity), // Số âm biểu thị xuất đi
            Action = "OUTBOUND",
            Timestamp = DateTime.UtcNow,
            Message = $"Đã xuất {request.Quantity} sản phẩm khỏi kệ {bin.Code}"
        });

        return Result<Guid>.Success(bin.Id, _localizer["Outbound_Success"]);
    }
}