using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Common.Utils;

namespace SmartWMS.Application.Features.Users.Commands;

public class UpdateUserCommandHandler : IRequestHandler<UpdateUserCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public UpdateUserCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<bool>> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        // Khuyến khích sử dụng SingleOrDefaultAsync hoặc FirstOrDefaultAsync để đảm bảo cơ chế ChangeTracker của EF hoạt động chính xác
        var user = await _context.Users.FindAsync(new object[] { request.Id }, cancellationToken);

        if (user == null)
            return Result<bool>.Failure("Không tìm thấy tài khoản.");

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;

        user.Role = request.Role;
        user.IsActive = request.IsActive;

        // Nếu admin gõ mật khẩu mới thì tiến hành đổi, nếu không thì giữ nguyên mật khẩu cũ
        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            user.PasswordHash = SecurityUtils.HashPassword(request.NewPassword);
        }

        // Hệ thống Audit Log tự động sẽ ghi nhận chính xác trường nào bị đổi 
        // dựa vào việc đối chiếu OldValues và NewValues của FirstName/LastName trong JSON log!
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thông tin tài khoản thành công.");
    }
}