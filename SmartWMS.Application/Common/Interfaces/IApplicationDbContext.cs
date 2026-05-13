using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Product> Products { get; }
    DbSet<Warehouse> Warehouses { get; }
    DbSet<Zone> Zones { get; }
    DbSet<Bin> Bins { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}