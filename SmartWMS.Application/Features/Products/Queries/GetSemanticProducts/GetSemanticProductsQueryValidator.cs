using FluentValidation;

namespace SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;

public sealed class GetSemanticProductsQueryValidator : AbstractValidator<GetSemanticProductsQuery>
{
    public GetSemanticProductsQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.SearchText)
                .NotEmpty().WithMessage("Vui lòng nhập nội dung tìm kiếm.")
                .MaximumLength(200).WithMessage("Nội dung tìm kiếm không được vượt quá 200 ký tự.");
        });
    }
}