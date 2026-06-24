using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Application.Features.Users.Commands.CreateUser;

public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    private readonly IApplicationDbContext _context;

    public CreateUserCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        RuleFor(v => v.Username)
            .NotEmpty().WithMessage("Tên đăng nhập không được để trống.")
            .MinimumLength(3).WithMessage("Tên đăng nhập phải có ít nhất 3 ký tự.")
            .MaximumLength(50).WithMessage("Tên đăng nhập không được vượt quá 50 ký tự.")
            .MustAsync(BeUniqueUsername).WithMessage("Tên đăng nhập này đã được sử dụng bởi một tài khoản khác."); // BỔ SUNG DÒNG NÀY

        RuleFor(v => v.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Định dạng Email không hợp lệ.")
            .MustAsync(BeUniqueEmail).WithMessage("Email này đã được sử dụng bởi một tài khoản khác.");

        RuleFor(v => v.FirstName)
            .NotEmpty().WithMessage("Tên không được để trống.")
            .MaximumLength(50).WithMessage("Tên không được quá 50 ký tự.");

        RuleFor(v => v.LastName)
            .NotEmpty().WithMessage("Họ và tên lót không được để trống.")
            .MaximumLength(50).WithMessage("Họ và tên lót không được quá 50 ký tự.");

        RuleFor(v => v.Password)
            .NotEmpty().WithMessage("Mật khẩu không được để trống.")
            .MinimumLength(6).WithMessage("Mật khẩu phải có độ dài tối thiểu là 6 ký tự.");

        RuleFor(v => v.Role)
            .NotEmpty().WithMessage("Vui lòng chỉ định vai trò cho tài khoản này.")
            .Must(role => role == "Admin" || role == "Manager" || role == "Staff")
            .WithMessage("Vai trò không hợp lệ. Chỉ chấp nhận: Admin, Manager hoặc Staff.");
    }

    private async Task<bool> BeUniqueUsername(string username, CancellationToken cancellationToken)
    {
        // BỔ SUNG HÀM NÀY: Ngăn chặn trùng lặp Tên đăng nhập (Không phân biệt hoa thường)
        return await _context.Users.AllAsync(u => u.Username.ToLower() != username.ToLower(), cancellationToken);
    }

    private async Task<bool> BeUniqueEmail(string email, CancellationToken cancellationToken)
    {
        // Ngăn chặn trùng lặp email trong hệ thống
        return await _context.Users.AllAsync(u => u.Email.ToLower() != email.ToLower(), cancellationToken);
    }
}