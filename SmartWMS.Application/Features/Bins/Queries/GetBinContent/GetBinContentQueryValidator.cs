using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent;

public class GetBinContentQueryValidator : AbstractValidator<GetBinContentQuery>
{
    public GetBinContentQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // Chặn đứng trường hợp súng quét PDA truyền lên mã Guid trống rỗng (Guid.Empty)
        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]); // Bản dịch đề xuất: "Mã định danh ô kệ (Bin ID) bắt buộc phải có."
    }
}