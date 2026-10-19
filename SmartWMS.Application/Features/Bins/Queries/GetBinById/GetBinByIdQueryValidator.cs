using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinById;

public class GetBinByIdQueryValidator : AbstractValidator<GetBinByIdQuery>
{
    public GetBinByIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("ID ô kệ không được để trống.")
                .NotEqual(Guid.Empty).WithMessage("ID ô kệ không hợp lệ.");
        });
    }
}