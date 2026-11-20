using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Queries;

public sealed class BinByIdSpec : Specification<Bin>
{
    public BinByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        AsNoTracking = true;
    }
}