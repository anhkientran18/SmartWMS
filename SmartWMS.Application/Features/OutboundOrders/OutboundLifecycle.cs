using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.OutboundOrders;

// Direct-pick v1: one source bin/order, whole-order allocation/pick/pack/ship, None/Lot only.
public sealed class OutboundLifecycle(IApplicationDbContext db, IInventoryMutationCoordinator mutations,
    IOutboundCoordinator locks, IInboundReceiveCoordinator bins)
{
    private static Result<bool> Conflict(string message) => Result<bool>.Failure(ErrorCodeConstants.Conflict, message);
    private static Result<bool> Invalid(string message) => Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);

    public Task<Result<bool>> AllocateAsync(Guid id, Guid? assignedUser, CancellationToken ct) => Run(id, async order =>
    {
        if (assignedUser.HasValue) return Invalid("Direct-pick B3 chưa hỗ trợ phân công task; bỏ assignedUserId.");
        if (order.IsDeleted || order.Status != "Pending" || !NewLines(order)) return Conflict("Chỉ allocate đơn Pending direct-pick chưa có tiến độ.");
        var allocations = await locks.LockAllocationsAsync(id, ct);
        if (allocations.Count != 0 || (await locks.LockReservationsAsync(id, ct)).Count != 0)
            return Conflict("Đơn đã có allocation/reservation; không reserve lần hai.");
        var bin = await bins.LockBinAsync(order.BinId, ct);
        if (bin == null || !await ValidOccupancy(bin, ct)) return Conflict("Hierarchy hoặc occupancy nguồn không hợp lệ.");
        var stock = await locks.LockStocksAsync(bin.Id, ct);
        // LockLot refreshes all rows of this product. Finish every refresh before changing
        // counters, including when several lines refer to the same product.
        var validated = new Dictionary<Guid, (Product Product, List<BinInventory> Rows)>();
        foreach (var productId in order.Items.Select(x => x.ProductId).Distinct().OrderBy(x => x))
        {
            var product = await Product(productId, ct);
            if (product == null) return Conflict("Chỉ hỗ trợ sản phẩm active None/Lot, không Serial.");
            var rows = new List<BinInventory>();
            foreach (var row in stock.Where(x => x.ProductId == productId && x.Status == InventoryStatus.Available &&
                x.Quantity > x.ReservedQuantity && !Expired(x)))
            {
                if (!InventoryMutationRules.ValidStock(row) || !string.IsNullOrEmpty(row.LpnCode) || await bins.HasSerialAsync(row.Id, ct)) continue;
                var lot = InventoryMutationRules.Lot(row.LotNumber);
                if (product.TrackingMode == ProductTrackingMode.Lot && string.IsNullOrWhiteSpace(row.LotNumber)) continue;
                var identity = await bins.LockLotAsync(bin.Id, productId, lot, ct);
                if (identity.Count(x => x.Status == InventoryStatus.Available) != 1)
                    return Conflict("Lot identity không duy nhất sau normalize; cần đối soát.");
                rows.Add(row);
            }
            validated.Add(productId, (product, rows.OrderBy(x => x.ExpirationDate ?? DateTime.MaxValue).ThenBy(x => x.Id).ToList()));
        }
        var allocation = new OutboundAllocation { OrderId=id, SourceBinId=bin.Id, Generation=1, IsDirectPick=true };
        db.OutboundAllocations.Add(allocation);
        foreach (var line in order.Items.OrderBy(x => x.ProductId).ThenBy(x => x.Id))
        {
            var (product, candidates) = validated[line.ProductId];
            var remaining = line.Quantity;
            foreach (var row in candidates)
            {
                var lot = InventoryMutationRules.Lot(row.LotNumber);
                var take = Math.Min(remaining, row.Quantity - row.ReservedQuantity);
                if (take == 0) continue;
                var reservation = new InventoryReservation { AllocationId=allocation.Id, OrderId=id, OrderItemId=line.Id,
                    SourceBinInventoryId=row.Id, Quantity=take, IsDirectPick=true, SourceLotNumber=lot, SourceExpirationDate=row.ExpirationDate };
                db.InventoryReservations.Add(reservation);
                row.ReservedQuantity += take;
                Ledger(line, reservation, row, bin, "RESERVATION", 0, $"RESERVE:{take}");
                remaining -= take;
                if (remaining == 0) break;
            }
            if (remaining != 0) return Conflict("Không đủ ATP hợp lệ (Quantity - ReservedQuantity) tại bin nguồn.");
            line.TrackingModeSnapshot = product.TrackingMode;
            line.ReservedQuantity = line.Quantity;
            line.Status = "Allocated";
        }
        order.Status = "Allocated";
        return Result<bool>.Success(true);
    }, ct);

    public Task<Result<bool>> PickAsync(Guid id, DirectPickRequest? request, CancellationToken ct)
    {
        if (request?.Items == null || request.Items.Count == 0 || request.Items.Any(x => x == null || x.ReservationId == Guid.Empty || x.Quantity <= 0) ||
            request.Items.Select(x => x.ReservationId).Distinct().Count() != request.Items.Count)
            return Task.FromResult(Invalid("items cần reservationId duy nhất, quantity > 0; pick toàn đơn."));
        return Run(id, async order =>
        {
            if (order.IsDeleted || order.Status != "Allocated") return Conflict("Chỉ pick đơn Allocated; duplicate/stale pick cần reload.");
            var allocation = await ActiveAllocation(order, ct);
            var reservations = await locks.LockReservationsAsync(id, ct);
            if (allocation == null || !ValidReservations(order, allocation, reservations, false) ||
                request.Items.Count != reservations.Count || reservations.Any(r => !request.Items.Any(x => x.ReservationId == r.Id && x.Quantity == r.Quantity)))
                return Conflict("Payload phải bao phủ đúng toàn bộ reservation đang active; không over/partial pick.");
            var bin = await bins.LockBinAsync(order.BinId, ct);
            if (bin == null || !await ValidOccupancy(bin, ct)) return Conflict("Hierarchy/occupancy nguồn đã thay đổi.");
            var stock = await locks.LockStocksAsync(bin.Id, ct);
            foreach (var line in order.Items)
            {
                var product = await Product(line.ProductId, ct);
                if (product == null || product.TrackingMode != line.TrackingModeSnapshot) return Conflict("TrackingMode/product đã thay đổi từ allocation.");
            }
            foreach (var group in reservations.GroupBy(x => x.SourceBinInventoryId))
            {
                var row = stock.SingleOrDefault(x => x.Id == group.Key);
                var quantity = group.Sum(x => (long)x.Quantity);
                if (row == null || !InventoryMutationRules.ValidStock(row) || row.Status != InventoryStatus.Available || Expired(row) ||
                    !string.IsNullOrEmpty(row.LpnCode) || row.Quantity < quantity || row.ReservedQuantity < quantity ||
                    await bins.HasSerialAsync(row.Id, ct) || group.Any(r => row.ProductId != order.Items.Single(l => l.Id == r.OrderItemId).ProductId ||
                        InventoryMutationRules.Lot(row.LotNumber) != r.SourceLotNumber || row.ExpirationDate != r.SourceExpirationDate))
                    return Conflict("Reservation source/lot/expiry/status/quantity không còn hợp lệ; không tự chọn row khác.");
                foreach (var r in group)
                {
                    var line = order.Items.Single(x => x.Id == r.OrderItemId);
                    row.Quantity -= r.Quantity;
                    row.ReservedQuantity -= r.Quantity;
                    bin.CurrentOccupancy -= r.Quantity;
                    r.PickedQuantity = r.Quantity; r.Status = "Picked";
                    Ledger(line, r, row, bin, "OUTBOUND", -r.Quantity, "DIRECT_PICK");
                }
            }
            if (!InventoryMutationRules.ValidOccupancy(bin, bin.CurrentOccupancy)) return Conflict("Occupancy sau pick không hợp lệ.");
            foreach (var line in order.Items) { line.ReservedQuantity=0; line.PickedQuantity=line.Quantity; line.Status="Picked"; }
            allocation.Status="Picked"; order.Status="Picked";
            return Result<bool>.Success(true);
        }, ct);
    }

    public Task<Result<bool>> PackAsync(Guid id, CancellationToken ct) => Finish(id, false, ct);
    public Task<Result<bool>> ShipAsync(Guid id, CancellationToken ct) => Finish(id, true, ct);

    private Task<Result<bool>> Finish(Guid id, bool ship, CancellationToken ct) => Run(id, async order =>
    {
        var expected = ship ? "Packed" : "Picked";
        var target = ship ? "Shipped" : "Packed";
        if (order.IsDeleted || (order.Status != expected && order.Status != target)) return Conflict($"Chỉ chuyển {expected} -> {target}.");
        var allocations = await locks.LockAllocationsAsync(id, ct);
        var allocation = allocations.SingleOrDefault(x => x.IsDirectPick);
        var reservations = await locks.LockReservationsAsync(id, ct);
        var already = order.Status == target;
        if (allocation == null || allocations.Count != 1 || !ValidReservations(order, allocation, reservations, true) ||
            allocation.Status != (ship && already ? "Shipped" : "Picked") || allocation.IsActive == (ship && already) ||
            order.Items.Any(x => x.Status != order.Status || x.ShippedQuantity != (ship && already ? x.Quantity : 0)) ||
            reservations.Any(x => x.Status != (ship && already ? "Shipped" : "Picked") || x.ShippedQuantity != (ship && already ? x.Quantity : 0)))
            return Conflict("Persisted progress chưa đầy đủ hoặc không thuộc direct-pick.");
        if (already) return Result<bool>.Success(true, "Đã hoàn tất; không lặp side effect.");
        foreach (var line in order.Items)
        {
            line.Status=target;
            if (ship) line.ShippedQuantity=line.Quantity;
        }
        if (ship)
        {
            foreach (var r in reservations)
            {
                r.ShippedQuantity=r.Quantity; r.Status="Shipped"; r.CompletedAt=DateTime.UtcNow;
                db.InventoryTransactions.Add(new InventoryTransaction { Id=Guid.NewGuid(), ProductId=order.Items.Single(x=>x.Id==r.OrderItemId).ProductId,
                    BinInventoryId=r.SourceBinInventoryId, OutboundOrderItemId=r.OrderItemId, InventoryReservationId=r.Id,
                    TransactionType="SHIP_CONFIRM", QuantityChanged=0, ReasonCode="DIRECT_PICK_ALREADY_DEDUCTED" });
            }
            allocation.IsActive=false; allocation.Status="Shipped"; allocation.CompletedAt=DateTime.UtcNow;
        }
        order.Status=target;
        return Result<bool>.Success(true);
    }, ct);

    public Task<Result<bool>> CancelAsync(Guid id, CancellationToken ct) => Run(id, async order =>
    {
        if (order.Status is not ("Pending" or "Allocated") || order.IsDeleted) return Conflict("Chỉ cancel Pending/Allocated; Picked/Packed cần reversal ngoài scope.");
        var allocations = await locks.LockAllocationsAsync(id, ct);
        var reservations = await locks.LockReservationsAsync(id, ct);
        if (order.Status == "Pending")
        {
            if (!NewLines(order) || allocations.Count != 0 || reservations.Count != 0) return Conflict("Đơn Pending có workflow/progress không hợp lệ.");
        }
        else
        {
            var allocation = allocations.SingleOrDefault(x=>x.IsDirectPick && x.IsActive);
            if (allocation == null || allocations.Count != 1 || !ValidReservations(order, allocation, reservations, false)) return Conflict("Reservation không khớp để release.");
            // Cancellation must still work after soft deletion/expiry: lock the physical bin without requiring active hierarchy.
            var stock = await locks.LockStocksAsync(order.BinId, ct);
            foreach (var group in reservations.GroupBy(x=>x.SourceBinInventoryId))
            {
                var row=stock.SingleOrDefault(x=>x.Id==group.Key);
                if (row == null || !InventoryMutationRules.ValidStock(row) || row.ReservedQuantity < group.Sum(x=>(long)x.Quantity)) return Conflict("Reserved counter không đủ để release; cần đối soát.");
                foreach (var r in group)
                {
                    row.ReservedQuantity-=r.Quantity; r.ReleasedQuantity=r.Quantity; r.Status="Released"; r.CompletedAt=DateTime.UtcNow;
                    db.InventoryTransactions.Add(new InventoryTransaction { Id=Guid.NewGuid(), ProductId=row.ProductId, BinInventoryId=row.Id,
                        OutboundOrderItemId=r.OrderItemId, InventoryReservationId=r.Id, TransactionType="RESERVATION_RELEASE", QuantityChanged=0, ReasonCode=$"CANCEL:{r.Quantity}" });
                }
            }
            allocation.IsActive=false; allocation.Status="Released"; allocation.CompletedAt=DateTime.UtcNow;
        }
        foreach (var line in order.Items) { line.ReservedQuantity=0; line.Status="Cancelled"; }
        order.Status="Cancelled"; order.IsDeleted=true;
        return Result<bool>.Success(true);
    }, ct);

    private async Task<Result<bool>> Run(Guid id, Func<OutboundIssue, Task<Result<bool>>> action, CancellationToken ct)
    {
        if (id == Guid.Empty) return Invalid("Order ID bắt buộc.");
        await using var tx = await mutations.BeginAsync(ct);
        try
        {
            var order = await locks.LockOrderAsync(id, ct);
            if (order == null) return Result<bool>.Failure(ErrorCodeConstants.NotFound, "Không tìm thấy đơn xuất.");
            var result = await action(order);
            if (!result.IsSuccess) return result; // Dispose rolls back and clears the tracker, including prevalidation mutations.
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return result;
        }
        catch (Exception ex) when (locks.IsConflict(ex))
        {
            await tx.RollbackAsync();
            return Conflict("Conflict khi xử lý outbound; đọc lại order/reservations trước khi quyết định gửi lại.");
        }
    }

    private static bool NewLines(OutboundIssue order) => order.Items.Count>0 && order.Items.All(x=>x.IsDirectPick && x.Status=="Pending" && x.Quantity>0 &&
        x.ReservedQuantity==0 && x.PickedQuantity==0 && x.StagedQuantity==0 && x.ShippedQuantity==0);
    private async Task<Product?> Product(Guid id, CancellationToken ct) => await db.Products.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id && !x.IsDeleted &&
        (x.TrackingMode==ProductTrackingMode.None || x.TrackingMode==ProductTrackingMode.Lot), ct);
    private static bool Expired(BinInventory row) => row.ExpirationDate.HasValue && row.ExpirationDate.Value <= DateTime.UtcNow;
    private async Task<bool> ValidOccupancy(Bin bin, CancellationToken ct) => InventoryMutationRules.ValidOccupancy(bin, bin.CurrentOccupancy) &&
        bin.CurrentOccupancy == await bins.PhysicalQuantityAsync(bin.Id, ct);
    private async Task<OutboundAllocation?> ActiveAllocation(OutboundIssue order, CancellationToken ct)
    {
        var rows = await locks.LockAllocationsAsync(order.Id, ct);
        return rows.Count==1 && rows[0].IsDirectPick && rows[0].IsActive && rows[0].Status=="Active" && rows[0].SourceBinId==order.BinId ? rows[0] : null;
    }
    private static bool ValidReservations(OutboundIssue order, OutboundAllocation allocation, List<InventoryReservation> rows, bool picked) =>
        order.Items.Count>0 && rows.Count>0 && allocation.IsDirectPick && allocation.SourceBinId==order.BinId && allocation.StagingBinId==null &&
        rows.All(r=>r.IsDirectPick && r.AllocationId==allocation.Id && r.OrderId==order.Id && r.Quantity>0 && r.ReleasedQuantity==0 && r.StagingBinInventoryId==null &&
            r.SourceLotNumber!=null && r.PickedQuantity==(picked?r.Quantity:0) && order.Items.Any(l=>l.Id==r.OrderItemId) &&
            (picked || (r.Status=="Active" && r.ShippedQuantity==0))) &&
        order.Items.All(l=>l.IsDirectPick && l.Quantity>0 && l.StagedQuantity==0 && l.PickedQuantity==(picked?l.Quantity:0) && l.ReservedQuantity==(picked?0:l.Quantity) &&
            (picked || (l.Status=="Allocated" && l.ShippedQuantity==0)) &&
            l.TrackingModeSnapshot is ProductTrackingMode.None or ProductTrackingMode.Lot && rows.Where(r=>r.OrderItemId==l.Id).Sum(r=>(long)r.Quantity)==l.Quantity);
    private void Ledger(OutboundOrderItem line, InventoryReservation reservation, BinInventory row, Bin bin, string kind, int delta, string reason) =>
        db.InventoryTransactions.Add(new InventoryTransaction { Id=Guid.NewGuid(), ProductId=line.ProductId, BinInventoryId=row.Id,
            OutboundOrderItemId=line.Id, InventoryReservationId=reservation.Id, TransactionType=kind, QuantityChanged=delta,
            SourceBinCode=bin.Code, ReasonCode=reason });
}
