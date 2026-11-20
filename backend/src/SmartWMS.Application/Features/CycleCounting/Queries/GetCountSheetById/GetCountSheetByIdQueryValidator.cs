using FluentValidation;
using System;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetCountSheetById;

public class GetCountSheetByIdQueryValidator : AbstractValidator<GetCountSheetByIdQuery>
{
    public GetCountSheetByIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Mã phiếu kiểm kê không được để trống.")
                .NotEqual(Guid.Empty).WithMessage("Mã phiếu kiểm kê không hợp lệ.");
        });
    }
}