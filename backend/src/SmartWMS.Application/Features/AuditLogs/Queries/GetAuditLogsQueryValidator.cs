using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.AuditLogs.Queries.GetAuditLogs; // Lưu ý namespace có đuôi GetAuditLogs

public class GetAuditLogsQueryValidator : AbstractValidator<GetAuditLogsQuery>
{
    public GetAuditLogsQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(x => x.RequestData)
            .NotNull()
            .WithMessage(_ => localizer["RequestData_NotNull"]);

        When(x => x.RequestData != null, () =>
        {
            // 1. Kiểm tra số trang (Dùng PageIndex thay vì PageNumber để khớp cấu trúc DTO)
            RuleFor(v => v.RequestData.PageIndex)
                .GreaterThanOrEqualTo(1)
                .WithMessage(_ => localizer["PageNumber_Invalid"]);

            // 2. Kiểm tra kích thước trang an toàn
            RuleFor(v => v.RequestData.PageSize)
                .GreaterThanOrEqualTo(1)
                .WithMessage(_ => localizer["PageSize_MinInvalid"])
                .LessThanOrEqualTo(100)
                .WithMessage(_ => localizer["PageSize_MaxInvalid"]);
        });
    }
}