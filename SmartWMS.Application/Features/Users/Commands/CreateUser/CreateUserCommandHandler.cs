using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Common.Utils; // Nhận diện SecurityUtils
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.Users.Commands.CreateUser;

public class CreateUserCommandHandler : IRequestHandler<CreateUserCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;

    public CreateUserCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<Guid>> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        // 1. Mã hóa mật khẩu thô thành Hash chuỗi bảo mật bằng SecurityUtils của project
        // (Giúp bảo mật tài khoản, không lưu mật khẩu thô xuống database)
        string hashedPassword = SecurityUtils.HashPassword(request.Password);

        // 2. Khởi tạo thực thể User mới
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            Email = request.Email,
            PasswordHash = hashedPassword, // Ánh xạ vào cột thuộc tính PasswordHash của bảng Users
            FirstName = request.FirstName,
            LastName = request.LastName,
            Role = request.Role,
            IsActive = true // Mặc định tài khoản mới tạo sẽ ở trạng thái hoạt động
        };

        // 3. Thêm vào DbContext và lưu xuống SQL Server
        _context.Users.Add(user);

        // Hệ thống Audit Log tự động (DbContext) bạn vừa làm ở bước trước 
        // sẽ tự động bắt hành động này và lưu log dạng JSON mà bạn không cần viết thêm code ở đây!
        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(user.Id, $"Tạo tài khoản thành công cho người dùng: {user.Username}");
    }
}