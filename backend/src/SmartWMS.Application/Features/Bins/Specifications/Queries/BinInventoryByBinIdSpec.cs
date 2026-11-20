using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Queries;

public sealed class BinInventoriesByBinIdSpec : Specification<BinInventory>
{
    public BinInventoriesByBinIdSpec(Guid binId)
    {
        AndCriteria(x => x.BinId == binId);
        AddInclude(x => x.Product); // Eager Loading bảng Product
        AsNoTracking = true;
    }
}