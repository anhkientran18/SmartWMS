using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard;

public class GetWarehouseDashboardQueryValidator : AbstractValidator<GetWarehouseDashboardQuery>
{
    public GetWarehouseDashboardQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu truy vấn không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            When(x => x.RequestData.FromDate.HasValue && x.RequestData.ToDate.HasValue, () =>
            {
                RuleFor(x => x.RequestData.FromDate!.Value)
                    .LessThanOrEqualTo(x => x.RequestData.ToDate!.Value)
                    .WithMessage("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
            });

            When(x => x.RequestData.WarehouseId.HasValue, () =>
            {
                RuleFor(x => x.RequestData.WarehouseId!.Value)
                    .NotEqual(Guid.Empty).WithMessage("ID kho không hợp lệ.");
            });
        });
    }
}