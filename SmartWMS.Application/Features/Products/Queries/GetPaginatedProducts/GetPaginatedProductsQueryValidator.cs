using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Products.Queries.GetPaginatedProducts;

public class GetPaginatedProductsQueryValidator : AbstractValidator<GetPaginatedProductsQuery>
{
    public GetPaginatedProductsQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Khóa số trang: Phải lớn hơn hoặc bằng 1
        RuleFor(v => v.PageNumber)
            .GreaterThanOrEqualTo(1)
            .WithMessage(_ => localizer["PageNumber_Invalid"]);

        // 2. Khóa kích thước trang: Giới hạn an toàn từ 1 đến tối đa 100 bản ghi/lượt gọi để tránh tràn RAM Server
        RuleFor(v => v.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage(_ => localizer["PageSize_MinInvalid"])
            .LessThanOrEqualTo(100)
            .WithMessage(_ => localizer["PageSize_MaxInvalid"]);
    }
}