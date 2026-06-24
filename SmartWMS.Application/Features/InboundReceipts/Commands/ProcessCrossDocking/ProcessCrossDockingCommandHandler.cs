using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking;

public class ProcessCrossDockingCommandHandler : IRequestHandler<ProcessCrossDockingCommand, Result<CrossDockDirectiveDto>>
{
    private readonly IApplicationDbContext _context;

    public ProcessCrossDockingCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CrossDockDirectiveDto>> Handle(ProcessCrossDockingCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.SKU))
        {
            return Result<CrossDockDirectiveDto>.Failure("Mã SKU không được để trống.");
        }

        if (request.ReceivedQuantity <= 0)
        {
            return Result<CrossDockDirectiveDto>.Failure("Số lượng hàng nhập thực tế phải lớn hơn 0.");
        }

        var product = await _context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SKU == request.SKU, cancellationToken);

        if (product == null)
        {
            return Result<CrossDockDirectiveDto>.Failure($"Sản phẩm có mã SKU {request.SKU} không tồn tại.");
        }

        // ============================================================================
        // 🌟 ĐÃ SỬA: Sử dụng SelectMany để làm phẳng danh sách và tính tổng ở bảng con
        // ============================================================================
        var pendingOutboundQuantity = await _context.OutboundIssues
            .AsNoTracking()
            .SelectMany(x => x.Items) // Bóp phẳng tập hợp con OutboundOrderItems
            .Where(item => item.Product != null && item.Product.SKU == request.SKU)
            .SumAsync(item => item.Quantity, cancellationToken);
        // ============================================================================

        var directive = new CrossDockDirectiveDto();

        if (pendingOutboundQuantity == 0)
        {
            directive.IsCrossDockEligible = false;
            directive.CrossDockQuantity = 0;
            directive.RemainingPutawayQuantity = request.ReceivedQuantity;
            directive.TargetOutboundDock = "N/A";
            directive.Message = "Không có nhu cầu xuất trùng khớp. Hãy mang toàn bộ hàng đi cất vào ô kệ (Put-away).";

            return Result<CrossDockDirectiveDto>.Success(directive);
        }

        directive.IsCrossDockEligible = true;

        if (request.ReceivedQuantity <= pendingOutboundQuantity)
        {
            directive.CrossDockQuantity = request.ReceivedQuantity;
            directive.RemainingPutawayQuantity = 0;
            directive.Message = $"🔥 KHỚP CROSS-DOCK HOÀN TOÀN! Chuyển ngay {directive.CrossDockQuantity} thùng ra thẳng xe xuất.";
        }
        else
        {
            directive.CrossDockQuantity = pendingOutboundQuantity;
            directive.RemainingPutawayQuantity = request.ReceivedQuantity - pendingOutboundQuantity;
            directive.Message = $"⚡ KHỚP CROSS-DOCK MỘT PHẦN! Chuyển {directive.CrossDockQuantity} thùng ra xe xuất, mang {directive.RemainingPutawayQuantity} thùng còn lại cất lên kệ.";
        }

        directive.TargetOutboundDock = "Gate-Outbound-04";

        return Result<CrossDockDirectiveDto>.Success(directive);
    }
}