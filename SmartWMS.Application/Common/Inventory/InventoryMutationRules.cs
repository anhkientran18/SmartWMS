using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Common.Inventory;

public static class InventoryMutationRules
{
    public static string Lot(string? value) => string.IsNullOrWhiteSpace(value) ? "LOT-DEFAULT" : value.Trim();

    public static bool ValidStock(BinInventory stock) =>
        stock.Quantity >= 0 && stock.ReservedQuantity >= 0 && stock.ReservedQuantity <= stock.Quantity;

    public static bool ValidOccupancy(Bin bin, double next) =>
        double.IsFinite(bin.CurrentOccupancy) && double.IsFinite(bin.MaxCapacity) &&
        bin.CurrentOccupancy >= 0 && bin.MaxCapacity >= 0 &&
        double.IsFinite(next) && next >= 0 && next <= bin.MaxCapacity;

    public static async Task<Bin?> ValidBinAsync(IApplicationDbContext context, Guid id, CancellationToken ct)
    {
        return await context.Bins.AsTracking()
            .Where(x => x.Id == id && !x.IsDeleted && x.Zone != null && !x.Zone.IsDeleted &&
                x.Zone.Warehouse != null && !x.Zone.Warehouse.IsDeleted)
            .SingleOrDefaultAsync(ct);
    }
}
