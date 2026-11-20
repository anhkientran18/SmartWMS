using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.CycleCounting.Specifications.Queries;

public sealed class CountSheetByIdSpec : Specification<CycleCountSheet>
{
    public CountSheetByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        AddInclude(x => x.Items);
        AddInclude("Items.Product");
        AddInclude("Items.Bin");
        AddInclude(x => x.Zone!);
        AddInclude(x => x.Bin!);
        AsNoTracking = true;
    }
}