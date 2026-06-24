using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Users.Commands;

public class DeleteUserCommandHandler : IRequestHandler<DeleteUserCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public DeleteUserCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<bool>> Handle(DeleteUserCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FindAsync(new object[] { request.Id }, cancellationToken);

        if (user == null)
            return Result<bool>.Failure("Tài khoản không tồn tại.");

        // Ràng buộc bảo mật: Không bao giờ được phép xóa tài khoản Admin gốc của hệ thống
        if (user.Username.ToLower() == "admin")
            return Result<bool>.Failure("Không thể xóa tài khoản Quản trị tối cao.");

        _context.Users.Remove(user);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Xóa tài khoản thành công.");
    }
}