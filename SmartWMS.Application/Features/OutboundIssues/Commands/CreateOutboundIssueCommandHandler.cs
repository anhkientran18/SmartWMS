using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.OutboundIssues.Commands;

public class CreateOutboundIssueCommandHandler : IRequestHandler<CreateOutboundIssueCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;
    private readonly IStringLocalizer<SharedResource> _localizer;

    public CreateOutboundIssueCommandHandler(IApplicationDbContext context, IStringLocalizer<SharedResource> localizer)
    {
        _context = context;
        _localizer = localizer;
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
            // Trả về lỗi: "Không đủ số lượng tồn kho để xuất"
            return Result<Guid>.Failure(_localizer["Insufficient_Stock"]);
        }

        // 4. Trừ số lượng tồn kho
        bin.CurrentOccupancy -= request.Quantity;

        await _context.SaveChangesAsync(cancellationToken);

        // Trả về thông báo thành công: "Xuất kho thành công"
        return Result<Guid>.Success(bin.Id, _localizer["Outbound_Success"]);
    }
}