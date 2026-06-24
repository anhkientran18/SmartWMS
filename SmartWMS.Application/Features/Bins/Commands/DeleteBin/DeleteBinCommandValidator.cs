using FluentValidation;

namespace SmartWMS.Application.Features.Bins.Commands.DeleteBin;

public class DeleteBinCommandValidator : AbstractValidator<DeleteBinCommand>
{
    public DeleteBinCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Vui lòng cung cấp mã định danh (Id) ô kệ cần xóa.");
    }
}   