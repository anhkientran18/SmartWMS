using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Common.Inventory;

public static class CycleCountRules
{
    public static async Task<bool> SupportedAsync(IApplicationDbContext context,
        IInventoryMutationCoordinator mutations, ICycleCountCoordinator counts, BinInventory stock, CancellationToken ct)
    {
        if (!InventoryMutationRules.ValidStock(stock) || stock.ReservedQuantity != 0 ||
            stock.Status == InventoryStatus.Reserved || !Enum.IsDefined(stock.Status) ||
            !string.IsNullOrWhiteSpace(stock.LpnCode)) return false;
        var product = await context.Products.AsNoTracking().SingleOrDefaultAsync(x => x.Id == stock.ProductId && !x.IsDeleted, ct);
        if (product == null || product.TrackingMode == ProductTrackingMode.Serial ||
            !Enum.IsDefined(product.TrackingMode)) return false;
        var bin = await counts.LockBinAsync(stock.BinId, ct);
        return bin != null && InventoryMutationRules.ValidOccupancy(bin, bin.CurrentOccupancy) &&
            !await counts.HasSerialAsync(stock.Id, ct) && !await mutations.HasWorkflowAsync(stock, ct);
    }
}
