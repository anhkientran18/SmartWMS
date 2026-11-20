using FluentValidation;

namespace SmartWMS.Application.Features.Products.Queries.GetProductById;

public sealed class GetProductByIdQueryValidator : AbstractValidator<GetProductByIdQuery>
{
    public GetProductByIdQueryValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Id)
                .NotEmpty().WithMessage("Mã định danh sản phẩm (Id) không được để trống.");
        });
    }
}