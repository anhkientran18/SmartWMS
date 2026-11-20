using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery;

public class GetDashboardInsightQueryValidator : AbstractValidator<GetDashboardInsightQuery>
{
    public GetDashboardInsightQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu truy vấn không được để trống.");

        When(x => x.RequestData != null && x.RequestData.WarehouseId.HasValue, () =>
        {
            RuleFor(x => x.RequestData.WarehouseId!.Value)
                .NotEqual(Guid.Empty).WithMessage("ID kho không hợp lệ.");
        });
    }
}