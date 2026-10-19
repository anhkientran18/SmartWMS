using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent;

public class GetBinContentQueryValidator : AbstractValidator<GetBinContentQuery>
{
    public GetBinContentQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.BinId)
                .NotEmpty().WithMessage("Mã định danh ô kệ (Bin ID) bắt buộc phải có.")
                .NotEqual(Guid.Empty).WithMessage("ID ô kệ không hợp lệ.");
        });
    }
}