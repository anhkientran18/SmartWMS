using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Transactions;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Commands.Update;

public class UpdateProductCommandHandler : IRequestHandler<UpdateProductCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;

    public UpdateProductCommandHandler(IUnitOfWork unitOfWork, IApplicationDbContext context)
    {
        _unitOfWork = unitOfWork;
        _context = context;
    }

    public async Task<Result<bool>> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        using var transaction = new TransactionScope(TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable },
            TransactionScopeAsyncFlowOption.Enabled);
        var repo = _unitOfWork.Repository<Product>();
        var reqData = request.RequestData;

        // Serializable read/range locks retain the configuration and dependency checks until commit.
        var product = await _context.Products.AsTracking()
            .FirstOrDefaultAsync(x => x.Id == reqData.Id, cancellationToken);
        if (product == null)
            return Result<bool>.Failure(ErrorCodeConstants.ProductNotFound, "Không tìm thấy sản phẩm.");

        // 1. Kiểm tra SKU trùng lặp (trừ chính nó)
        var skuSpec = new ProductBySkuForUpdateSpec(reqData.Id, reqData.SKU);
        if (await repo.AnyAsync(skuSpec, cancellationToken))
        {
            return Result<bool>.Failure(ErrorCodeConstants.SkuAlreadyExists, "Mã SKU này đã được sử dụng bởi một sản phẩm khác.");
        }

        // 2. Lấy sản phẩm cần update
        if (reqData.TrackingMode.HasValue && reqData.TrackingMode.Value != product.TrackingMode)
        {
            if (await HasTrackingDependenciesAsync(product.Id, cancellationToken))
                return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                    "Không thể đổi TrackingMode khi sản phẩm đã có serial, tồn kho hoặc chứng từ/workflow đang mở.");
            product.TrackingMode = reqData.TrackingMode.Value;
        }

        // 3. Cập nhật thông tin
        product.SKU = reqData.SKU;
        product.Barcode = reqData.Barcode;
        product.Name = reqData.Name;
        product.Description = reqData.Description;
        product.Unit = reqData.Unit;

        repo.Update(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        transaction.Complete();

        return Result<bool>.Success(true, "Cập nhật sản phẩm thành công.");
    }
    private async Task<bool> HasTrackingDependenciesAsync(System.Guid id, CancellationToken ct)
    {
        if (await _context.ProductSerialNumbers.AnyAsync(x => x.ProductId == id, ct) ||
            await _context.BinInventories.AnyAsync(x => x.ProductId == id, ct) ||
            await _context.InboundReceipts.AnyAsync(x => !x.IsDeleted && x.Status != "Completed" && x.Items.Any(i => i.ProductId == id), ct) ||
            await _context.OutboundIssues.AnyAsync(x => !x.IsDeleted && x.Status != "Shipped" && x.Items.Any(i => i.ProductId == id), ct) ||
            await _context.CycleCountItems.AnyAsync(x => x.ProductId == id && !x.CountSheet.IsDeleted &&
                x.CountSheet.Status != "Completed" && x.CountSheet.Status != "Cancelled", ct))
            return true;

        // Soft-deleted or inconsistent headers must not hide a live workflow.
        return await _context.OutboundAllocations.AnyAsync(x => x.IsActive && x.Order.Items.Any(i => i.ProductId == id), ct) ||
            await _context.InventoryReservations.AnyAsync(x => x.OrderItem.ProductId == id &&
                (x.Status != "Shipped" && x.Status != "Released" || (long)x.Quantity > (long)x.ShippedQuantity + x.ReleasedQuantity), ct) ||
            await _context.PickTasks.AnyAsync(x => x.Reservation.OrderItem.ProductId == id &&
                x.Status != "Completed" && x.Status != "Released", ct) ||
            await _context.WavePickTasks.AnyAsync(x => x.IsActive && x.PickTask.Reservation.OrderItem.ProductId == id, ct);
    }
}
