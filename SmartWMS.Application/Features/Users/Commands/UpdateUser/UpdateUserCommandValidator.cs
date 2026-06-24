using FluentValidation;

namespace SmartWMS.Application.Features.Users.Commands;

public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        // 1. Kiểm tra Id bắt buộc phải có để xác định user cần sửa
        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Id người dùng không được để trống.");

        // 2. Kiểm tra dữ liệu Họ và Tên mới tách
        RuleFor(v => v.FirstName)
            .NotEmpty().WithMessage("Tên không được để trống.")
            .MaximumLength(50).WithMessage("Tên không được quá 50 ký tự.");

        RuleFor(v => v.LastName)
            .NotEmpty().WithMessage("Họ và tên lót không được để trống.")
            .MaximumLength(100).WithMessage("Họ và tên lót không được quá 100 ký tự.");

        // 3. Kiểm tra vai trò hợp lệ
        RuleFor(v => v.Role)
            .NotEmpty().WithMessage("Vui lòng chỉ định vai trò cho tài khoản này.")
            .Must(role => role == "Admin" || role == "Manager" || role == "Worker" || role == "Staff")
            .WithMessage("Vai trò không hợp lệ. Chỉ chấp nhận các vai trò hệ thống quy định.");

        // 4. Kiểm tra mật khẩu mới (Chỉ validate ĐỘ DÀI khi admin có nhập mật khẩu mới)
        RuleFor(v => v.NewPassword)
            .MinimumLength(6).WithMessage("Mật khẩu mới phải có độ dài tối thiểu là 6 ký tự.")
            .When(v => !string.IsNullOrWhiteSpace(v.NewPassword));
    }
}