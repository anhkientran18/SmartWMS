# Flow Mời Thành Viên (User Invitation) - C# ASP.NET Core

Phân tích và triển khai chi tiết luồng Mời thành viên (User Invitation) theo kiến trúc Clean Architecture, CQRS (với `MediatR`) và ASP.NET Core Identity.

## 1. Domain Layer: Entity `UserInvitation`

Khai báo đối tượng đại diện cho lời mời trong hệ thống. `UserInvitation` sẽ được lưu vào cơ sở dữ liệu.

```csharp
// Domain/Entities/UserInvitation.cs
namespace SmartWMS.Domain.Entities;

public class UserInvitation
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string InvitedRole { get; set; } = string.Empty;
    public string AssignedWarehouseId { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiryDate { get; set; }
    public bool IsUsed { get; set; }
}
```

> **Lưu ý**: Cần phải đăng ký thể hiện `DbSet<UserInvitation>` trong `ApplicationDbContext` ở lớp Infrastructure để ánh xạ Entity này xuống Database.

## 2. Application Layer: Mẫu Result Pattern

Định nghĩa Result Pattern hỗ trợ xử lý luồng trả về đồng nhất mà không lặp lại mã chặn ném Exception (Exception throwing) cho các kiểm soát nghiệp vụ thông thường.

```csharp
// Application/Common/Models/Result.cs
namespace SmartWMS.Application.Common.Models;

public class Result
{
    public bool IsSuccess { get; }
    public string? ErrorMessage { get; }

    protected Result(bool isSuccess, string? errorMessage)
    {
        IsSuccess = isSuccess;
        ErrorMessage = errorMessage;
    }

    public static Result Success() => new Result(true, null);
    public static Result Failure(string errorMessage) => new Result(false, errorMessage);
}
```

## 3. Application Layer: Gửi Lời Mời (`SendInvitationCommand`)

Xử lý logic theo yêu cầu: kiểm tra User tồn tại, sinh `Token` ngẫu nhiên an toàn, cấu hình URL và gọi Interface thông báo `IEmailService`.

```csharp
// Application/Invitations/Commands/SendInvitationCommand.cs
using MediatR;
using Microsoft.AspNetCore.Identity;
using System.Security.Cryptography;
using SmartWMS.Domain.Entities;
using SmartWMS.Application.Common.Models;
// require IApplicationDbContext, IEmailService abstractions

namespace SmartWMS.Application.Invitations.Commands;

public record SendInvitationCommand(string Email, string RoleId, string WarehouseId) : IRequest<Result>;

public class SendInvitationCommandHandler : IRequestHandler<SendInvitationCommand, Result>
{
    private readonly IApplicationDbContext _dbContext; // Chứa DbSet<UserInvitation>
    private readonly UserManager<IdentityUser> _userManager;
    private readonly IEmailService _emailService;

    public SendInvitationCommandHandler(
        IApplicationDbContext dbContext,
        UserManager<IdentityUser> userManager,
        IEmailService emailService)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _emailService = emailService;
    }

    public async Task<Result> Handle(SendInvitationCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra Email đã tồn tại chưa trong Identity
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser != null)
        {
            return Result.Failure("Email đã tồn tại trong hệ thống. Vui lòng chọn email khác.");
        }

        // (Tuỳ chọn) Kiểm tra lời mời Pending hiện tại tránh Spam
        // ...

        // 2. Sinh mã chuỗi bí mật bằng Cryptographic Random Number Generator (An toàn, URL-Safe)
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes)
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

        // 3. Khởi tạo đối tượng lưu trữ lời mời
        var invitation = new UserInvitation
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            InvitedRole = request.RoleId,
            AssignedWarehouseId = request.WarehouseId,
            Token = token,
            ExpiryDate = DateTime.UtcNow.AddHours(24),
            IsUsed = false
        };

        // 4. Lưu CSDL
        _dbContext.UserInvitations.Add(invitation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 5. Gửi thư (Email) với Link kích hoạt
        var activationLink = $"https://smartwms.com/setup-password?token={token}";
        var emailBody = $@"
            <h3>Chào mừng bạn đến với SmartWMS</h3>
            <p>Bạn đã được cấu hình hoạt động trong hệ thống với vai trò: <strong>{request.RoleId}</strong>.</p>
            <p>Vui lòng hoàn thiện hồ sơ và thiết lập mật khẩu bằng cách truy cập vào đường dẫn dưới đây:</p>
            <a href='{activationLink}' style='padding: 10px 15px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 5px;'>Kích hoạt tài khoản</a>
            <p><small>Liên kết có hiệu lực 24 giờ. Sau thời gian này bạn cần liên hệ người quản trị để cấp lại liên kết.</small></p>
        ";

        await _emailService.SendEmailAsync(request.Email, "Thư mời kích hoạt tài khoản SmartWMS", emailBody, cancellationToken);

        return Result.Success();
    }
}
```

## 4. Application Layer: Xác Nhận Lời Mời (`ConfirmInvitationCommand`)

Bước xử lý dữ liệu khi luồng Front-End bắt tham số `?token=XYZ` và gửi cùng `Mật khẩu mới` về phía Backend.

```csharp
// Application/Invitations/Commands/ConfirmInvitationCommand.cs
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Models;
// require IApplicationDbContext

namespace SmartWMS.Application.Invitations.Commands;

public record ConfirmInvitationCommand(string Token, string Password) : IRequest<Result>;

public class ConfirmInvitationCommandHandler : IRequestHandler<ConfirmInvitationCommand, Result>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly UserManager<IdentityUser> _userManager;

    public ConfirmInvitationCommandHandler(
        IApplicationDbContext dbContext,
        UserManager<IdentityUser> userManager)
    {
        _dbContext = dbContext;
        _userManager = userManager;
    }

    public async Task<Result> Handle(ConfirmInvitationCommand request, CancellationToken cancellationToken)
    {
        // 1. Đối chiếu theo Token trong ngữ cảnh bảo mật
        var invitation = await _dbContext.UserInvitations
            .FirstOrDefaultAsync(i => i.Token == request.Token, cancellationToken);

        if (invitation == null)
            return Result.Failure("Token liên kết không hợp lệ hoặc không tồn tại.");

        if (invitation.IsUsed)
            return Result.Failure("Link kích hoạt này đã được sử dụng. Vui lòng đăng nhập.");

        if (invitation.ExpiryDate < DateTime.UtcNow)
            return Result.Failure("Đường dẫn kích hoạt đã hết hiệu lực. Xin hãy liên hệ với Quản trị viên.");

        // 2. Khởi tạo đối tượng Core User
        var newUser = new IdentityUser
        {
            UserName = invitation.Email,
            Email = invitation.Email,
            EmailConfirmed = true // Mặc định true vì truy cập từ mail
        };

        // 3. Tiến hành Tạo Account và Mã hoá Mật khẩu do người dùng nhập
        var createUserResult = await _userManager.CreateAsync(newUser, request.Password);

        if (!createUserResult.Succeeded)
        {
            var errors = string.Join(", ", createUserResult.Errors.Select(e => e.Description));
            return Result.Failure($"Lỗi thao tác dữ liệu khởi tạo tài khoản: {errors}");
        }

        // 4. Gán Vai Trò (Role) đã gắn trong lời mời
        // Chú ý: RoleId (tên) phải tồn tại trong Db.
        var addRoleResult = await _userManager.AddToRoleAsync(newUser, invitation.InvitedRole);
        if (!addRoleResult.Succeeded)
        {
            return Result.Failure("Tạo tài khoản thành công nhưng xảy ra lỗi khi gán quyền.");
        }

        // (Tuỳ chọn) Gán WarehouseID xuống Entity CustomUser hoặc Claims
        // await _userManager.AddClaimAsync(newUser, new Claim("AssignedWarehouse", invitation.AssignedWarehouseId));

        // 5. Cập nhật Status khoá Token lại
        invitation.IsUsed = true;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
```
