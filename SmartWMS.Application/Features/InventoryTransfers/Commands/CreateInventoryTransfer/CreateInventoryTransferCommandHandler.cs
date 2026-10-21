using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.InventoryTransfers.Commands.CreateInventoryTransfer;

public sealed class CreateInventoryTransferCommandHandler(
    IApplicationDbContext context, IInventoryMutationCoordinator coordinator)
    : IRequestHandler<CreateInventoryTransferCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateInventoryTransferCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || req.TransferQuantity <= 0 || req.SourceBinId == req.DestinationBinId)
            return Invalid("Số lượng phải dương và ô nguồn phải khác ô đích.");
        await using var transaction = await coordinator.BeginAsync(ct);
        try
        {
            var product = await context.Products.AsNoTracking().SingleOrDefaultAsync(x => x.Id == req.ProductId && !x.IsDeleted, ct);
            if (product == null || product.TrackingMode == ProductTrackingMode.Serial)
                return Invalid("Sản phẩm không hợp lệ hoặc cần hợp đồng luân chuyển chỉ rõ serial.");
            // Read bins and inventory identities in a stable order for opposing transfers.
            var bins = new Dictionary<Guid, Bin>();
            foreach (var id in new[] { req.SourceBinId, req.DestinationBinId }.OrderBy(x => x))
            {
                var bin = await InventoryMutationRules.ValidBinAsync(context, id, ct);
                if (bin == null) return Invalid("Hierarchy Bin/Zone/Warehouse không hợp lệ.");
                bins.Add(id, bin);
            }
            var lot = InventoryMutationRules.Lot(req.LotNumber);
            var rows = new Dictionary<Guid, List<BinInventory>>();
            foreach (var id in bins.Keys.OrderBy(x => x))
                rows[id] = await coordinator.LockLotAsync(id, req.ProductId, lot, ct);
            var sources = rows[req.SourceBinId].Where(x => x.Status == InventoryStatus.Available).ToList();
            var destinations = rows[req.DestinationBinId].Where(x => x.Status == InventoryStatus.Available).ToList();
            if (sources.Count != 1 || destinations.Count > 1) return Invalid("Không xác định duy nhất tồn kho nguồn/đích.");
            var source = sources[0];
            if (!string.IsNullOrWhiteSpace(source.LpnCode))
                return Invalid("Không thể luân chuyển theo số lượng đối với tồn kho có LPN.");
            var destination = destinations.SingleOrDefault();
            if (!InventoryMutationRules.ValidStock(source) || (long)source.Quantity - source.ReservedQuantity < req.TransferQuantity)
                return Invalid("Ô nguồn không đủ số lượng khả dụng (Quantity - ReservedQuantity).");
            if (destination != null && (!InventoryMutationRules.ValidStock(destination) ||
                destination.ExpirationDate != source.ExpirationDate || !string.Equals(destination.LpnCode, source.LpnCode, StringComparison.Ordinal)))
                return Invalid("Không thể gộp tồn kho có expiry/LPN khác nhau hoặc reservation không hợp lệ.");
            long nextDestination = (long)(destination?.Quantity ?? 0) + req.TransferQuantity;
            var sourceBin = bins[req.SourceBinId];
            var destinationBin = bins[req.DestinationBinId];
            double sourceOccupancy = sourceBin.CurrentOccupancy - req.TransferQuantity;
            double destinationOccupancy = destinationBin.CurrentOccupancy + req.TransferQuantity;
            if (nextDestination > int.MaxValue || !InventoryMutationRules.ValidOccupancy(sourceBin, sourceOccupancy) ||
                !InventoryMutationRules.ValidOccupancy(destinationBin, destinationOccupancy))
                return Invalid("Số lượng hoặc sức chứa/occupancy vượt giới hạn hợp lệ.");

            if (destination == null)
            {
                destination = new BinInventory { Id = Guid.NewGuid(), BinId = req.DestinationBinId, ProductId = req.ProductId,
                    LotNumber = source.LotNumber, Status = InventoryStatus.Available,
                    ExpirationDate = source.ExpirationDate };
                context.BinInventories.Add(destination);
            }
            source.Quantity -= req.TransferQuantity;
            destination.Quantity = (int)nextDestination;
            sourceBin.CurrentOccupancy = sourceOccupancy;
            destinationBin.CurrentOccupancy = destinationOccupancy;
            var idTransaction = Guid.NewGuid();
            context.InventoryTransactions.Add(new InventoryTransaction { Id = idTransaction, ProductId = req.ProductId,
                BinInventoryId = source.Id, DestinationBinInventoryId = destination.Id,
                TransactionType = "TRANSFER", QuantityChanged = req.TransferQuantity,
                SourceBinCode = sourceBin.Code, DestinationBinCode = destinationBin.Code,
                ReasonCode = req.Reason, CreatedBy = "WarehouseStaff", CreatedAt = DateTime.UtcNow });
            await context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Result<Guid>.Success(idTransaction, "Luân chuyển nội bộ thành công.");
        }
        catch (Exception ex) when (coordinator.IsConflict(ex))
        {
            await transaction.RollbackAsync();
            return Result<Guid>.Failure(ErrorCodeConstants.Conflict, "Tồn kho đã thay đổi đồng thời; hãy tải lại dữ liệu.");
        }
    }
    private static Result<Guid> Invalid(string message) => Result<Guid>.Failure(ErrorCodeConstants.ValidationError, message);
}
