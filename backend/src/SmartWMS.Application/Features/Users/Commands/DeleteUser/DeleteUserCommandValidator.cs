using FluentValidation;

namespace SmartWMS.Application.Features.Users.Commands.DeleteUser;

public class DeleteUserCommandValidator : AbstractValidator<DeleteUserCommand>
{
    public DeleteUserCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Vui lòng cung cấp mã định danh (Id) người dùng cần xóa.");
    }
}