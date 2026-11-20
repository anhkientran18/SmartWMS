using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.CycleCounting.Specifications.Queries;

public sealed class CountSheetListSpec : Specification<CycleCountSheet>
{
    public CountSheetListSpec(string? status, string? keyword)
    {
        AndCriteria(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(status))
        {
            AndCriteria(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim().ToLower();
            AndCriteria(x => x.BatchCode.ToLower().Contains(search) || x.Notes.ToLower().Contains(search));
        }

        AddInclude(x => x.Zone!);
        AddInclude(x => x.Bin!);
        ApplyOrderByDescending(x => x.CreatedAt);
        AsNoTracking = true;
    }
}