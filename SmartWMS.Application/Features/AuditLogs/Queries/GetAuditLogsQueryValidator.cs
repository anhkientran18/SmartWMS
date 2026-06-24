using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.AuditLogs.Queries;

public class GetAuditLogsQueryValidator : AbstractValidator<GetAuditLogsQuery>
{
    public GetAuditLogsQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra số trang: Bắt buộc phải lớn hơn hoặc bằng 1
        RuleFor(v => v.PageNumber)
            .GreaterThanOrEqualTo(1)
            .WithMessage(_ => localizer["PageNumber_Invalid"]); // Bản dịch đề xuất: "Số trang phải lớn hơn hoặc bằng 1."

        // 2. Kiểm tra kích thước trang: Phải nằm trong khoảng an toàn (Từ 1 đến tối đa 100 bản ghi trên mỗi lượt gọi)
        RuleFor(v => v.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage(_ => localizer["PageSize_MinInvalid"])
            .LessThanOrEqualTo(100)
            .WithMessage(_ => localizer["PageSize_MaxInvalid"]); // Bản dịch đề xuất: "Kích thước trang phải nằm trong khoảng từ 1 đến 100 dòng."
    }
}