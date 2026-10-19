using FluentValidation;

namespace SmartWMS.Application.Features.Bins.Commands.DeleteBin;

public class DeleteBinCommandValidator : AbstractValidator<DeleteBinCommand>
{
    public DeleteBinCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id).NotEmpty().WithMessage("Vui lòng cung cấp Id ô kệ cần xóa.");
        });
    }
}