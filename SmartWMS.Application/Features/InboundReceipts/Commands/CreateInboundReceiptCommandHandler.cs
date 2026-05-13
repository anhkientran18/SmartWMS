using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InboundReceipts.Commands;

public class CreateInboundReceiptCommandHandler : IRequestHandler<CreateInboundReceiptCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context; // Thay đổi kiểu dữ liệu thành Interface
    private readonly IStringLocalizer<SharedResource> _localizer;

    public CreateInboundReceiptCommandHandler(IApplicationDbContext context, IStringLocalizer<SharedResource> localizer)
    {
        _context = context;
        _localizer = localizer;
    }

    public async Task<Result<Guid>> Handle(CreateInboundReceiptCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra SKU
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.SKU == request.SKU, cancellationToken);

        if (product == null)
            return Result<Guid>.Failure(_localizer["Product_NotFound"]);

        // 2. Kiểm tra Bin
        var bin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.BinId, cancellationToken);

        if (bin == null)
            return Result<Guid>.Failure(_localizer["Bin_NotFound"]);

        if (bin.CurrentOccupancy + request.Quantity > bin.MaxCapacity)
            return Result<Guid>.Failure(_localizer["Bin_OverCapacity"]);

        // 3. Cập nhật số lượng
        bin.CurrentOccupancy += request.Quantity;

        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(bin.Id, _localizer["Inbound_Success"]);
    }
}