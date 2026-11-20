using FluentValidation;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetList;

public class GetCountSheetListQueryValidator : AbstractValidator<GetCountSheetListQuery>
{
    public GetCountSheetListQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
    }
}