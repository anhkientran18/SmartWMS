using FluentValidation;

namespace SmartWMS.Application.Features.Products.Queries.GetPaginatedProducts;

public sealed class GetPaginatedProductsQueryValidator : AbstractValidator<GetPaginatedProductsQuery>
{
    public GetPaginatedProductsQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull()
            .WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.PageIndex)
                .GreaterThan(0).WithMessage("Số trang phải lớn hơn 0.");

            RuleFor(x => x.RequestData.PageSize)
                .GreaterThan(0).WithMessage("Kích thước trang phải lớn hơn 0.")
                .LessThanOrEqualTo(100).WithMessage("Kích thước trang không được vượt quá 100.");
        });
    }
}