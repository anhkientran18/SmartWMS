using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Commands;

public sealed class BinByIdForUpdateSpec : Specification<Bin>
{
    public BinByIdForUpdateSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        EnableTracking(); // Bắt buộc để Update
    }
}