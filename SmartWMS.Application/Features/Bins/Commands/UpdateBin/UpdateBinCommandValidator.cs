using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Bins.Commands.UpdateBin;

public class UpdateBinCommandValidator : AbstractValidator<UpdateBinCommand>
{
    public UpdateBinCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Purpose)
                .Must(value => !value.HasValue || System.Enum.IsDefined(value.Value))
                .WithMessage("Giá trị Purpose không hợp lệ.");
            RuleFor(v => v.RequestData.Id).NotEmpty().WithMessage("Mã định danh ô kệ không được trống.");
            RuleFor(v => v.RequestData.Code)
                .NotEmpty().WithMessage("Mã ô kệ không được để trống.")
                .MaximumLength(50).WithMessage("Mã ô kệ không được quá 50 ký tự.");
            RuleFor(v => v.RequestData.MaxCapacity)
                .GreaterThan(0).WithMessage("Sức chứa tối đa phải lớn hơn 0.");
        });
    }
}