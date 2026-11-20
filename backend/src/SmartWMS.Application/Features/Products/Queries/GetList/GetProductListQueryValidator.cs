using FluentValidation;

namespace SmartWMS.Application.Features.Products.Queries.GetList;

public sealed class GetProductListQueryValidator : AbstractValidator<GetProductListQuery>
{
    public GetProductListQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.SearchKeyword)
                .MaximumLength(200)
                .When(x => !string.IsNullOrWhiteSpace(x.RequestData.SearchKeyword))
                .WithMessage("Từ khóa tìm kiếm không được vượt quá 200 ký tự.");
        });
    }
}