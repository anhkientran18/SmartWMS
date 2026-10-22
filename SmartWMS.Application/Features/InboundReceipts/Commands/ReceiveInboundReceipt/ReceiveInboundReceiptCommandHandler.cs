using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ReceiveInboundReceipt;

public sealed class ReceiveInboundReceiptCommandHandler(IApplicationDbContext context,
    IInventoryMutationCoordinator mutations, IInboundReceiveCoordinator receiving,
    IInventoryNotificationService notifications, ILogger<ReceiveInboundReceiptCommandHandler> logger)
    : IRequestHandler<ReceiveInboundReceiptCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ReceiveInboundReceiptCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || req.InboundReceiptId == Guid.Empty || req.ReceivedItems == null || req.ReceivedItems.Count == 0 ||
            req.ReceivedItems.Any(x => x == null || x.ItemId == Guid.Empty || x.QuantityReceived <= 0 ||
                !x.ExpectedReceivedQuantity.HasValue || x.ExpectedReceivedQuantity < 0) ||
            req.ReceivedItems.Select(x => x.ItemId).Distinct().Count() != req.ReceivedItems.Count)
            return Invalid("Mỗi detail phải xuất hiện đúng một lần, có lượng nhận thêm dương và ExpectedReceivedQuantity không âm.");

        var updates = new List<InventoryUpdateModel>();
        string finalStatus;
        await using (var tx = await mutations.BeginAsync(ct))
        {
            try
            {
                var receipt = await receiving.LockReceiptAsync(req.InboundReceiptId, ct);
                if (receipt == null || receipt.IsDeleted) return Invalid("Phiếu nhập không tồn tại hoặc đã bị xóa.");
                if (receipt.Status is not ("New" or "Pending" or "Processing"))
                    return Conflict("Phiếu không còn ở trạng thái được nhận hàng; hãy tải lại dữ liệu.");
                if (!receipt.BinId.HasValue || receipt.Items.Count == 0 ||
                    receipt.Items.Any(x => x.QuantityExpected <= 0 || x.QuantityReceived < 0 || x.QuantityReceived > x.QuantityExpected))
                    return Invalid("Phiếu thiếu BinId hoặc có số lượng detail không hợp lệ.");
                if (receipt.SupplierId.HasValue && !await context.Suppliers.AsNoTracking()
                    .AnyAsync(x => x.Id == receipt.SupplierId && !x.IsDeleted, ct))
                    return Invalid("Nhà cung cấp không còn hoạt động.");
                var bin = await receiving.LockBinAsync(receipt.BinId.Value, ct);
                if (bin == null || !Enum.IsDefined(bin.Purpose))
                    return Invalid("Hierarchy Bin/Zone/Warehouse không hợp lệ hoặc đã bị xóa.");

                var items = receipt.Items.ToDictionary(x => x.Id);
                foreach (var input in req.ReceivedItems)
                {
                    if (!items.TryGetValue(input.ItemId, out var item)) return Invalid("Detail không thuộc phiếu nhập.");
                    // Compare under the receipt/detail update locks, before any mutation.
                    if (item.QuantityReceived != input.ExpectedReceivedQuantity)
                        return Conflict("Số lượng đã nhận đã thay đổi; request cũ không được áp dụng lại. Hãy tải lại phiếu.");
                    if ((long)item.QuantityReceived + input.QuantityReceived > item.QuantityExpected)
                        return Invalid("Số lượng nhận vượt quá số lượng còn lại trên phiếu.");
                }
                var total = req.ReceivedItems.Sum(x => (long)x.QuantityReceived);
                var physical = await receiving.PhysicalQuantityAsync(bin.Id, ct);
                if (physical < 0 || bin.CurrentOccupancy != physical || total > 9_007_199_254_740_991L - physical)
                    return Conflict("Occupancy không khớp tồn vật lý hoặc vượt giới hạn số nguyên chính xác; cần đối soát bin.");
                var nextOccupancy = bin.CurrentOccupancy + total;
                if (!InventoryMutationRules.ValidOccupancy(bin, nextOccupancy))
                    return Invalid("Lượng nhận làm occupancy không hợp lệ hoặc vượt MaxCapacity.");

                var productIds = req.ReceivedItems.Select(x => items[x.ItemId].ProductId).Distinct().ToList();
                var products = await context.Products.AsNoTracking().Where(x => productIds.Contains(x.Id) && !x.IsDeleted)
                    .ToDictionaryAsync(x => x.Id, ct);
                if (products.Count != productIds.Count) return Invalid("Sản phẩm không tồn tại hoặc đã bị xóa.");

                var plan = new List<(InboundReceiptItem Item, BinInventory Stock, int Quantity, Product Product)>();
                var newStocks = new Dictionary<(Guid Product, string Lot), BinInventory>();
                var now = DateTime.UtcNow;
                foreach (var input in req.ReceivedItems.OrderBy(x => items[x.ItemId].ProductId)
                    .ThenBy(x => InventoryMutationRules.Lot(items[x.ItemId].LotNumber), StringComparer.Ordinal))
                {
                    var item = items[input.ItemId];
                    var product = products[item.ProductId];
                    if (!Enum.IsDefined(product.TrackingMode) || product.TrackingMode == ProductTrackingMode.Serial)
                        return Invalid("UNSUPPORTED_SERIAL: Receive quantity không hỗ trợ Serial; cần contract ghi nhận serial trước khi nhận hàng.");
                    if (item.TrackingModeSnapshot.HasValue && item.TrackingModeSnapshot != product.TrackingMode)
                        return Conflict("TrackingMode của sản phẩm không khớp snapshot trên detail; cần đối soát phiếu.");
                    if (item.ExpirationDate.HasValue && item.ExpirationDate <= now)
                        return Invalid("Không nhận hàng đã hết hạn vào trạng thái Available.");
                    var lot = InventoryMutationRules.Lot(item.LotNumber);
                    if (lot.Length > 50) return Invalid("LotNumber không được vượt quá 50 ký tự.");
                    var rows = await receiving.LockLotAsync(bin.Id, item.ProductId, lot, ct);
                    if (rows.Any(x => !Enum.IsDefined(x.Status) || !InventoryMutationRules.ValidStock(x)))
                        return Invalid("Identity tồn kho có trạng thái/số lượng không hợp lệ.");
                    var available = rows.Where(x => x.Status == InventoryStatus.Available).ToList();
                    if (available.Count > 1) return Conflict("Có nhiều row Available cùng identity lot chuẩn hóa; cần đối soát.");
                    var stock = available.SingleOrDefault();
                    if (stock == null && !newStocks.TryGetValue((item.ProductId, lot), out stock))
                    {
                        stock = new BinInventory { Id = Guid.NewGuid(), BinId = bin.Id, ProductId = item.ProductId,
                            LotNumber = lot, ExpirationDate = item.ExpirationDate, Status = InventoryStatus.Available };
                        newStocks.Add((item.ProductId, lot), stock);
                    }
                    if (stock.ExpirationDate != item.ExpirationDate || !string.IsNullOrWhiteSpace(stock.LpnCode))
                        return Conflict("Available row có expiry/LPN không tương thích; không được gộp hàng.");
                    if (stock.ReservedQuantity != 0 || await mutations.HasWorkflowAsync(stock, ct) ||
                        await receiving.HasSerialAsync(stock.Id, ct))
                        return Conflict("Không gộp receive vào tồn kho có reservation/workflow/serial evidence.");
                    plan.Add((item, stock, input.QuantityReceived, product));
                }
                foreach (var group in plan.GroupBy(x => x.Stock.Id))
                    if ((long)group.First().Stock.Quantity + group.Sum(x => (long)x.Quantity) > int.MaxValue)
                        return Invalid("Số lượng tồn kho vượt giới hạn integer.");

                // Validate the entire batch first; quantities, evidence and audit then commit together.
                foreach (var stock in newStocks.Values) context.BinInventories.Add(stock);
                foreach (var line in plan)
                {
                    line.Item.QuantityReceived += line.Quantity;
                    line.Item.TrackingModeSnapshot ??= line.Product.TrackingMode;
                    line.Stock.Quantity += line.Quantity;
                    context.InventoryTransactions.Add(new InventoryTransaction
                    {
                        Id = Guid.NewGuid(), ProductId = line.Product.Id, BinInventoryId = line.Stock.Id,
                        TransactionType = "INBOUND", QuantityChanged = line.Quantity,
                        SourceBinCode = "RECEIVING_DOCK", DestinationBinCode = bin.Code,
                        ReasonCode = $"INBOUND_RECEIPT_{receipt.Id:N}_ITEM_{line.Item.Id:N}"
                    });
                    updates.Add(new InventoryUpdateModel { ProductId = line.Product.Id, ProductName = line.Product.Name,
                        Quantity = line.Quantity, Action = "INBOUND", Timestamp = now,
                        Message = $"Đã nhận {line.Quantity} sản phẩm vào kệ {bin.Code}" });
                }
                bin.CurrentOccupancy = nextOccupancy;
                receipt.Status = receipt.Items.All(x => x.QuantityReceived == x.QuantityExpected) ? "Completed" : "Processing";
                finalStatus = receipt.Status;
                await context.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            catch (Exception ex) when (mutations.IsConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict("Xung đột nhận hàng; không có mutation được commit. Hãy tải lại phiếu trước khi gửi tiếp.");
            }
        }

        // Realtime is best effort after commit. A failure cannot turn a committed receipt into an HTTP failure.
        foreach (var update in updates)
        {
            try { await notifications.SendInventoryUpdateAsync(update); }
            catch (Exception ex) { logger.LogError(ex, "Inbound receipt {ReceiptId} committed; realtime notification failed.", req.InboundReceiptId); }
        }
        return Result<bool>.Success(true, $"Đã commit nhận hàng. Trạng thái hiện tại: {finalStatus}");
    }

    private static Result<bool> Invalid(string message) => Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);
    private static Result<bool> Conflict(string message) => Result<bool>.Failure(ErrorCodeConstants.Conflict, message);
}
