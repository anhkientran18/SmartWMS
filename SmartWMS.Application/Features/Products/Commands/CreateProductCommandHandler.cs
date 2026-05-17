using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Products.Commands;

public class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;
    private readonly IStringLocalizer<SharedResource> _localizer;

    public CreateProductCommandHandler(IApplicationDbContext context, IStringLocalizer<SharedResource> localizer)
    {
        _context = context;
        _localizer = localizer;
    }

    public async Task<Result<Guid>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra SKU trùng lặp
        var isSkuExists = await _context.Products
            .AnyAsync(p => p.SKU == request.SKU, cancellationToken);

        if (isSkuExists)
        {
            return Result<Guid>.Failure("Mã SKU này đã tồn tại trong hệ thống mMDM.");
        }
        // BỔ SUNG KIỂM TRA: Tránh trùng mã vạch (Barcode) gây lỗi DB index độc bản
        var isBarcodeExists = await _context.Products
            .AnyAsync(p => p.Barcode == request.Barcode, cancellationToken);

        if (isBarcodeExists)
        {
            return Result<Guid>.Failure("Mã vạch (Barcode) này đã tồn tại trên một sản phẩm khác.");
        }
        // 2. Khởi tạo đối tượng Product từ lệnh Command
        var product = new Product
        {
            Id = Guid.NewGuid(),
            SKU = request.SKU,
            Barcode = request.Barcode,
            Name = request.Name,
            Unit = request.Unit,
            Description = request.Description,
            // Nếu thực thể Product trong Domain của bạn chưa có Width/Height/Depth, 
            // tạm thời bạn có thể bỏ qua hoặc bổ sung thuộc tính vào Entity Product sau.
        };

        _context.Products.Add(product);

        // Luồng lưu dữ liệu này sẽ tự động kích hoạt ghi Audit Log tên Người dùng thực tế
        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(product.Id, "Thêm mới sản phẩm vào danh mục thành công.");
    }
}