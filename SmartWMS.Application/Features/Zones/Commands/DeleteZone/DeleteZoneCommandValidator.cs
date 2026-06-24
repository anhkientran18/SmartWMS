using FluentValidation;
using SmartWMS.Application.Features.Zones.Commands;

namespace SmartWMS.Application.Features.Zones.Commands.DeleteZone;

public class DeleteZoneCommandValidator : AbstractValidator<DeleteZoneCommand>
{
    public DeleteZoneCommandValidator()
    {
        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Vui lòng cung cấp chính xác mã định danh (Id) khu vực cần xóa.");
    }
}