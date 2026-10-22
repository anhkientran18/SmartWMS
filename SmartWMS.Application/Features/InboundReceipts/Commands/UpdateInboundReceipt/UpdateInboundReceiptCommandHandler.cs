using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.Specifications.Queries;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.UpdateInboundReceipt;

public sealed class UpdateInboundReceiptCommandHandler(IUnitOfWork unitOfWork,
    IApplicationDbContext context, IInventoryMutationCoordinator mutations)
    : IRequestHandler<UpdateInboundReceiptCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(UpdateInboundReceiptCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || req.Items == null || req.Items.Count == 0 ||
            req.Items.Any(x => x == null || x.ProductId == Guid.Empty || x.ExpectedQuantity <= 0) ||
            req.Items.Select(x => x.ProductId).Distinct().Count() != req.Items.Count)
            return Invalid("Danh sách mặt hàng phải hợp lệ và xác định duy nhất theo sản phẩm.");

        await using var tx = await mutations.BeginAsync(ct);
        try
        {
            var receipt = await unitOfWork.Repository<InboundReceipt>()
                .GetEntityWithSpecAsync(new InboundReceiptByIdForUpdateSpec(req.Id), ct);
            if (receipt == null) return Invalid("Không tìm thấy phiếu nhập kho cần cập nhật.");
            if (receipt.Status != "Pending" && receipt.Status != "Draft" && receipt.Status != "New")
                return Invalid($"Không thể chỉnh sửa phiếu nhập kho đang ở trạng thái '{receipt.Status}'.");
            if (receipt.Items.Any(x => x.QuantityReceived != 0))
                return Invalid("Không thể chỉnh sửa phiếu nhập đã phát sinh số lượng thực nhận.");

            var productIds = req.Items.Select(x => x.ProductId).ToHashSet();
            // The current DTO has no item Id or lot/expiry fields. Never guess which lot to replace.
            if (receipt.Items.Where(x => productIds.Contains(x.ProductId))
                .GroupBy(x => x.ProductId).Any(g => g.Count() > 1))
                return Invalid("Phiếu có nhiều detail cùng sản phẩm; contract hiện tại không xác định được detail/lô cần sửa.");
            if (await context.Products.CountAsync(x => productIds.Contains(x.Id) && !x.IsDeleted, ct) != productIds.Count)
                return Invalid("Sản phẩm không tồn tại hoặc đã bị xóa.");
            if (req.SupplierId.HasValue &&
                !await context.Suppliers.AnyAsync(x => x.Id == req.SupplierId && !x.IsDeleted, ct))
                return Invalid("Nhà cung cấp không tồn tại hoặc đã bị xóa.");
            if (req.BinId.HasValue)
            {
                if (await unitOfWork.Repository<Bin>()
                    .GetEntityWithSpecAsync(new ActiveBinByIdSpec(req.BinId.Value), ct) == null)
                    return Invalid("Ô kệ đích không tồn tại hoặc không còn hoạt động.");
                receipt.BinId = req.BinId.Value;
            }

            receipt.SupplierId = req.SupplierId;
            receipt.ExpectedDeliveryDate = req.ExpectedDeliveryDate;
            receipt.ReferenceDocument = req.ReferenceDocument ?? string.Empty;
            receipt.Notes = req.Notes ?? string.Empty;

            var items = unitOfWork.Repository<InboundReceiptItem>();
            foreach (var old in receipt.Items.Where(x => !productIds.Contains(x.ProductId)).ToList())
            {
                receipt.Items.Remove(old);
                items.Delete(old);
            }
            var existing = receipt.Items.ToDictionary(x => x.ProductId);
            foreach (var item in req.Items)
            {
                if (existing.TryGetValue(item.ProductId, out var old))
                {
                    // Preserve Id, LotNumber, ExpirationDate and tracking evidence not exposed by the DTO.
                    old.QuantityExpected = item.ExpectedQuantity;
                }
                else
                {
                    var added = new InboundReceiptItem
                    {
                        Id = Guid.NewGuid(), InboundReceiptId = receipt.Id,
                        ProductId = item.ProductId, QuantityExpected = item.ExpectedQuantity,
                        QuantityReceived = 0
                    };
                    receipt.Items.Add(added);
                    await items.AddAsync(added, ct);
                }
            }
            // The header and retained details are already tracked. Update(graph) would mark new GUIDs Modified.
            await unitOfWork.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Result<bool>.Success(true, "Cập nhật phiếu nhập kho thành công.");
        }
        catch (Exception ex) when (mutations.IsConflict(ex))
        {
            await tx.RollbackAsync();
            return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                "Phiếu nhập đã thay đổi đồng thời; không có thay đổi được commit. Hãy tải lại.");
        }
    }

    private static Result<bool> Invalid(string message) =>
        Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);
}
