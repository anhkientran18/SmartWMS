using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Bins.Queries.GetPaginatedBinsByZoneId;

public class GetPaginatedBinsByZoneIdQueryValidator : AbstractValidator<GetPaginatedBinsByZoneIdQuery>
{
    public GetPaginatedBinsByZoneIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            // Chỉ kiểm tra khi ZoneId được truyền lên
            When(x => x.RequestData.ZoneId.HasValue, () =>
            {
                RuleFor(x => x.RequestData.ZoneId!.Value)
                    .NotEqual(Guid.Empty).WithMessage("ID khu vực (ZoneId) không hợp lệ.");
            });

            RuleFor(x => x.RequestData.PageNumber).GreaterThanOrEqualTo(1);
            RuleFor(x => x.RequestData.PageSize).InclusiveBetween(1, 100);
        });
    }
}