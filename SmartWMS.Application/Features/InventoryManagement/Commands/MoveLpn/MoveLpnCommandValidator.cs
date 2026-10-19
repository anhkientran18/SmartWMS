using FluentValidation;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveLpn;

public class MoveLpnCommandValidator : AbstractValidator<MoveLpnCommand>
{
    public MoveLpnCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.LpnCode).NotEmpty().WithMessage("Mã Pallet (LPN) không được trống.");
            RuleFor(x => x.RequestData.ToBinId).NotEmpty().NotEqual(Guid.Empty).WithMessage("Vui lòng chọn ô kệ đích hợp lệ.");
        });
    }
}