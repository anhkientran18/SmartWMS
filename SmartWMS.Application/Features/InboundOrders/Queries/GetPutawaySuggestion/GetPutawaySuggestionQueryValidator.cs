using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InboundOrders.Queries.GetPutawaySuggestion;

public class GetPutawaySuggestionQueryValidator : AbstractValidator<GetPutawaySuggestionQuery>
{
    public GetPutawaySuggestionQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra ID sản phẩm cần tìm chỗ cất
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 2. Kiểm tra phân khu chỉ định tìm kiếm ô kệ
        RuleFor(v => v.ZoneId)
            .NotEmpty()
            .WithMessage(_ => localizer["ZoneId_Required"]);

        // 3. RÀNG BUỘC SỐ LƯỢNG: Số lượng hàng cần xếp vào kho bắt buộc phải > 0
        RuleFor(v => v.IncomingQuantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["IncomingQuantity_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng hàng hóa cần gợi ý vị trí cất phải lớn hơn 0."
    }
}