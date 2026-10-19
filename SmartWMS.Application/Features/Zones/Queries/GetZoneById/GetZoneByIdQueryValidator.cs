using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Zones.Queries.GetZoneById;

public class GetZoneByIdQueryValidator : AbstractValidator<GetZoneByIdQuery>
{
    public GetZoneByIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Mã định danh khu vực không được để trống.")
                .NotEqual(Guid.Empty).WithMessage("Mã định danh khu vực không hợp lệ.");
        });
    }
}