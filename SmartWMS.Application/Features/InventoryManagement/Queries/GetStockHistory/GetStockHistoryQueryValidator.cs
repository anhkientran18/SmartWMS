using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;

public class GetStockHistoryQueryValidator : AbstractValidator<GetStockHistoryQuery>
{
    // Tập hợp các từ khóa nghiệp vụ hợp lệ được định nghĩa sẵn trong hệ thống kho
    private readonly List<string> _allowedTypes = new() { "INBOUND", "OUTBOUND", "TRANSFER", "ADJUSTMENT", "" };

    public GetStockHistoryQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // Kiểm tra loại giao dịch: Nếu có truyền lên thì bắt buộc phải nằm trong danh mục cấu hình cho phép
        RuleFor(v => v.TransactionType)
            .Must(type => _allowedTypes.Contains(type?.ToUpper() ?? ""))
            .WithMessage(_ => localizer["TransactionType_Invalid"]) // Bản dịch đề xuất: "Loại giao dịch không hợp lệ. Hệ thống chỉ chấp nhận: INBOUND, OUTBOUND, TRANSFER, ADJUSTMENT."
            .MaximumLength(20)
            .WithMessage(_ => localizer["TransactionType_TooLong"]);
    }
}