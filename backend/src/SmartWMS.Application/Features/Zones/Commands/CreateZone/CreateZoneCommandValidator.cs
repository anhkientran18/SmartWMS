using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Zones.Commands.CreateZone;

public class CreateZoneCommandValidator : AbstractValidator<CreateZoneCommand>
{
    public CreateZoneCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Code)
                .NotEmpty().WithMessage("Mã khu vực không được để trống.")
                .MaximumLength(50).WithMessage("Mã khu vực không được quá 50 ký tự.");

            RuleFor(v => v.RequestData.Name)
                .NotEmpty().WithMessage("Tên khu vực không được để trống.")
                .MaximumLength(200).WithMessage("Tên khu vực không được quá 200 ký tự.");

            RuleFor(v => v.RequestData.WarehouseId)
                .NotEmpty().WithMessage("Vui lòng chọn Kho lưu trữ cho khu vực này.")
                .NotEqual(Guid.Empty).WithMessage("Mã kho không hợp lệ.");
        });
    }
}