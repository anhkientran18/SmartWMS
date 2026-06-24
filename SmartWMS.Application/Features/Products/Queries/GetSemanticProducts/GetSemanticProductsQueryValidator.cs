using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;

public class GetSemanticProductsQueryValidator : AbstractValidator<GetSemanticProductsQuery>
{
    public GetSemanticProductsQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // Chặn đứng trường hợp UI gửi chuỗi rỗng lên AI Gateway gây tốn chi phí token vô ích
        RuleFor(v => v.SearchText)
            .NotEmpty()
            .WithMessage(_ => localizer["SearchText_Required"])
            .MaximumLength(200)
            .WithMessage(_ => localizer["SearchText_TooLong"]);
    }
}