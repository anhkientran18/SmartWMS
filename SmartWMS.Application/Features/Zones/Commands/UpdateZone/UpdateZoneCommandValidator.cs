using FluentValidation;

namespace SmartWMS.Application.Features.Zones.Commands.UpdateZone;

public class UpdateZoneCommandValidator : AbstractValidator<UpdateZoneCommand>
{
    public UpdateZoneCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Id).NotEmpty().WithMessage("Mã định danh không được trống.");
            RuleFor(v => v.RequestData.Code).NotEmpty().MaximumLength(50);
            RuleFor(v => v.RequestData.Name).NotEmpty().MaximumLength(200);
        });
    }
}