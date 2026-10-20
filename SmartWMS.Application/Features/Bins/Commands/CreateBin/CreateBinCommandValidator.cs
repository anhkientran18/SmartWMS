using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Bins.Commands.CreateBin;

public class CreateBinCommandValidator : AbstractValidator<CreateBinCommand>
{
    public CreateBinCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Purpose).IsInEnum();
            RuleFor(v => v.RequestData.Code)
                .NotEmpty().WithMessage("Mã ô kệ không được để trống.")
                .MaximumLength(50).WithMessage("Mã ô kệ không được quá 50 ký tự.");

            RuleFor(v => v.RequestData.ZoneId)
                .NotEmpty().WithMessage("Vui lòng chọn khu vực (Zone) cho ô kệ này.")
                .NotEqual(Guid.Empty).WithMessage("Mã khu vực không hợp lệ.");

            RuleFor(v => v.RequestData.MaxCapacity)
                .GreaterThan(0).WithMessage("Sức chứa tối đa phải lớn hơn 0.");
        });
    }
}