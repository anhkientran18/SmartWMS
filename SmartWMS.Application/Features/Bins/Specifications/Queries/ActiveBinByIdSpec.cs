using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Queries;

public sealed class ActiveBinByIdSpec : Specification<Bin>
{
    public ActiveBinByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted && x.Zone != null &&
            !x.Zone.IsDeleted && !x.Zone.Warehouse.IsDeleted);
    }
}
