using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.CycleCounting.Specifications.Commands;

public sealed class CycleCountSheetWithItemsByIdSpec : Specification<CycleCountSheet>
{
    public CycleCountSheetWithItemsByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id);
        AddInclude(x => x.Items); // Kéo theo danh sách chi tiết để Update
        EnableTracking(); // Bật Tracking để lưu thay đổi
    }
}