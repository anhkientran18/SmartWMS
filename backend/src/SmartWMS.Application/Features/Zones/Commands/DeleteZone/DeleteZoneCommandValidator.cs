using FluentValidation;

namespace SmartWMS.Application.Features.Zones.Commands.DeleteZone;

public class DeleteZoneCommandValidator : AbstractValidator<DeleteZoneCommand>
{
    public DeleteZoneCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id).NotEmpty().WithMessage("Vui lòng cung cấp Id khu vực cần xóa.");
        });
    }
}