using FluentValidation;

namespace SmartWMS.Application.Features.Bins.Queries.GetList;

public class GetBinListQueryValidator : AbstractValidator<GetBinListQuery>
{
    public GetBinListQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");
    }
}