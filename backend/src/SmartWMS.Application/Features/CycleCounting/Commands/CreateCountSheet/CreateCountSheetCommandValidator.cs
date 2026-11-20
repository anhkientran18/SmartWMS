using FluentValidation;
using System;

namespace SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;

public class CreateCountSheetCommandValidator : AbstractValidator<CreateCountSheetCommand>
{
    public CreateCountSheetCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            // Bắt buộc phải truyền vào ZoneId hoặc BinId
            RuleFor(x => x.RequestData)
                .Must(req => (req.ZoneId.HasValue && req.ZoneId != Guid.Empty) || (req.BinId.HasValue && req.BinId != Guid.Empty))
                .WithMessage("Vui lòng chọn Khu vực (Zone) hoặc Ô kệ (Bin) để tiến hành kiểm kê.");
        });
    }
}