using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion;

public class GetPutawaySuggestionQueryValidator : AbstractValidator<GetPutawaySuggestionQuery>
{
    public GetPutawaySuggestionQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra mã SKU sản phẩm: Không được trống và không được quá dài
        RuleFor(v => v.SKU)
            .NotEmpty()
            .WithMessage(_ => localizer["SKU_Required"])
            .MaximumLength(50)
            .WithMessage(_ => localizer["SKU_TooLong"]);

        // 2. Kiểm tra số lượng hàng: Bắt buộc phải > 0 để thuật toán tính toán không gian chính xác
        RuleFor(v => v.Quantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["Quantity_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng hàng hóa yêu cầu gợi ý vị trí phải lớn hơn 0."
    }
}