using FluentValidation;

namespace SmartWMS.Application.Features.Auth.Commands.Login;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Request)
            .NotNull()
            .WithMessage("Yêu cầu đăng nhập không được để rỗng.");

        When(x => x.Request != null, () =>
        {
            RuleFor(x => x.Request.Username)
                .NotEmpty()
                .WithMessage("Tên đăng nhập không được để trống.");

            RuleFor(x => x.Request.Password)
                .NotEmpty()
                .WithMessage("Mật khẩu không được để trống.");
        });
    }
}