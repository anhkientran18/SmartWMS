# Cấu trúc C# .NET 8 Backend - SmartWMS RBAC

Dựa trên yêu cầu của bạn về kiến trúc sạch (Clean Architecture), CQRS với MediatR, và FluentValidation trong .NET 8, dưới đây là chi tiết mã nguồn triển khai tính năng Quản lý phân quyền (Permission Matrix).

## 1. Tầng Domain (Entities)
Tạo các thực thể để mở rộng Identity.

```csharp
// Domain/Entities/Permission.cs
namespace SmartWMS.Domain.Entities;

public class Permission
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PermissionKey { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;

    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

// Domain/Entities/RolePermission.cs
using Microsoft.AspNetCore.Identity;

namespace SmartWMS.Domain.Entities;

public class RolePermission
{
    public string RoleId { get; set; } = string.Empty;
    public IdentityRole Role { get; set; } = null!;

    public int PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;
}
```

## 2. Tầng Infrastructure (Data & Identity)

### 2.1 Cấu hình Fluent API và Seeding trong ApplicationDbContext

```csharp
// Infrastructure/Data/ApplicationDbContext.cs
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Infrastructure.Data;

public class ApplicationDbContext : IdentityDbContext<IdentityUser, IdentityRole, string>
{
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Cấu hình bảng Permission
        builder.Entity<Permission>(b =>
        {
            b.ToTable("Permissions");
            b.HasKey(p => p.Id);
            b.Property(p => p.PermissionKey).IsRequired().HasMaxLength(100);
            b.HasIndex(p => p.PermissionKey).IsUnique();
        });

        // Cấu hình khóa ngoại nhiều-nhiều RolePermission
        builder.Entity<RolePermission>(b =>
        {
            b.ToTable("RolePermissions");
            b.HasKey(rp => new { rp.RoleId, rp.PermissionId });

            b.HasOne(rp => rp.Role)
                .WithMany()
                .HasForeignKey(rp => rp.RoleId)
                .IsRequired();

            b.HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId)
                .IsRequired();
        });

        // Data Seeding: Quyền hạn
        var permissions = new List<Permission>
        {
            // Nhóm: Quản Lý Kho
            new() { Id = 1, Name = "Quản lý Hàng tồn & Kho", PermissionKey = "Warehouse.Manage", GroupName = "Quản Lý Kho" },
            new() { Id = 2, Name = "Phê duyệt Lệnh X/N", PermissionKey = "Warehouse.ApproveOrders", GroupName = "Quản Lý Kho" },
            new() { Id = 3, Name = "Quét mã vạch hiện trường", PermissionKey = "Warehouse.ScanBarcodes", GroupName = "Quản Lý Kho" },

            // Nhóm: Tính Năng AI
            new() { Id = 4, Name = "AI tự động soạn Email & Restock Ticket", PermissionKey = "AI.RestockTicket", GroupName = "Tính Năng AI" },
            new() { Id = 5, Name = "AI phân tích nhật ký & bất thường", PermissionKey = "AI.AuditAnomaly", GroupName = "Tính Năng AI" },

            // Nhóm: Cấu Hình Hệ Thống
            new() { Id = 6, Name = "Quản lý & phân quyền tài khoản", PermissionKey = "System.ManageUsers", GroupName = "Cấu Hình Hệ Thống" },
            new() { Id = 7, Name = "Truy cập nhật ký bảo mật", PermissionKey = "System.AuditLog", GroupName = "Cấu Hình Hệ Thống" }
        };

        builder.Entity<Permission>().HasData(permissions);
    }
}
```

### 2.2 Custom JWT Token Service
```csharp
// Infrastructure/Identity/JwtTokenGenerator.cs
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Infrastructure.Data;

namespace SmartWMS.Infrastructure.Identity;

public class JwtTokenGenerator
{
    private readonly ApplicationDbContext _dbContext;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly IConfiguration _config;

    public JwtTokenGenerator(ApplicationDbContext dbContext, UserManager<IdentityUser> userManager, IConfiguration config)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _config = config;
    }

    public async Task<string> GenerateTokenAsync(IdentityUser user)
    {
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Lấy Roles
        var roles = await _userManager.GetRolesAsync(user);
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        // Lấy danh sách PermissionKeys cho từng Role
        var permissions = await (from rp in _dbContext.RolePermissions
                                 join p in _dbContext.Permissions on rp.PermissionId equals p.Id
                                 join r in _dbContext.Roles on rp.RoleId equals r.Id
                                 where roles.Contains(r.Name!)
                                 select p.PermissionKey).Distinct().ToListAsync();

        foreach (var permission in permissions)
        {
            // Thêm vào chuỗi claims sử dụng AuthorizationDecision
            claims.Add(new Claim(ClaimTypes.AuthorizationDecision, permission));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
```

## 3. Tầng Application (CQRS với MediatR)

### 3.1 DTOs
```csharp
// Application/Permissions/DTOs.cs
namespace SmartWMS.Application.Permissions.DTOs;

public class PermissionMatrixDto
{
    public List<RoleDto> Roles { get; set; } = new();
    public List<PermissionCategoryDto> Categories { get; set; } = new();
}

public class RoleDto
{
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
}

public class PermissionCategoryDto
{
    public string CategoryName { get; set; } = string.Empty;
    public List<PermissionItemDto> Permissions { get; set; } = new();
}

public class PermissionItemDto
{
    public int PermissionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PermissionKey { get; set; } = string.Empty;
    public Dictionary<string, bool> RoleAccess { get; set; } = new(); // Key: RoleId, Value: true/false
}
```

### 3.2 Query: GetPermissionMatrixQuery
```csharp
// Application/Permissions/Queries/GetPermissionMatrixQuery.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Permissions.DTOs;
using SmartWMS.Infrastructure.Data;

namespace SmartWMS.Application.Permissions.Queries;

public record GetPermissionMatrixQuery() : IRequest<PermissionMatrixDto>;

public class GetPermissionMatrixQueryHandler : IRequestHandler<GetPermissionMatrixQuery, PermissionMatrixDto>
{
    private readonly ApplicationDbContext _dbContext;

    public GetPermissionMatrixQueryHandler(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<PermissionMatrixDto> Handle(GetPermissionMatrixQuery request, CancellationToken cancellationToken)
    {
        var result = new PermissionMatrixDto();

        // 1. Lấy danh sách Roles
        var roles = await _dbContext.Roles.ToListAsync(cancellationToken);
        result.Roles = roles.Select(r => new RoleDto { RoleId = r.Id, RoleName = r.Name! }).ToList();

        // 2. Lấy dữ liệu Permissions và RolePermissions
        var permissions = await _dbContext.Permissions.ToListAsync(cancellationToken);
        var rolePermissions = await _dbContext.RolePermissions.ToListAsync(cancellationToken);

        // 3. Phân nhóm theo Category (GroupName)
        var groupedPermissions = permissions.GroupBy(p => p.GroupName);

        foreach (var group in groupedPermissions)
        {
            var categoryDto = new PermissionCategoryDto { CategoryName = group.Key };

            foreach (var perm in group)
            {
                var permDto = new PermissionItemDto
                {
                    PermissionId = perm.Id,
                    Name = perm.Name,
                    PermissionKey = perm.PermissionKey
                };

                foreach (var role in roles)
                {
                    bool isEnabled = rolePermissions.Any(rp => rp.RoleId == role.Id && rp.PermissionId == perm.Id);
                    permDto.RoleAccess.Add(role.Id, isEnabled);
                }

                categoryDto.Permissions.Add(permDto);
            }
            result.Categories.Add(categoryDto);
        }

        return result;
    }
}
```

### 3.3 Command: UpdateRolePermissionCommand
```csharp
// Application/Permissions/Commands/UpdateRolePermissionCommand.cs
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Data;

namespace SmartWMS.Application.Permissions.Commands;

public record UpdateRolePermissionCommand(string RoleId, string PermissionKey, bool IsEnabled) : IRequest<bool>;

public class UpdateRolePermissionCommandValidator : AbstractValidator<UpdateRolePermissionCommand>
{
    public UpdateRolePermissionCommandValidator()
    {
        RuleFor(x => x.RoleId).NotEmpty();
        RuleFor(x => x.PermissionKey).NotEmpty();
    }
}

public class UpdateRolePermissionCommandHandler : IRequestHandler<UpdateRolePermissionCommand, bool>
{
    private readonly ApplicationDbContext _dbContext;

    public UpdateRolePermissionCommandHandler(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(UpdateRolePermissionCommand request, CancellationToken cancellationToken)
    {
        var permission = await _dbContext.Permissions
            .FirstOrDefaultAsync(p => p.PermissionKey == request.PermissionKey, cancellationToken);

        if (permission == null) return false;

        var existingRp = await _dbContext.RolePermissions
            .FirstOrDefaultAsync(rp => rp.RoleId == request.RoleId && rp.PermissionId == permission.Id, cancellationToken);

        if (request.IsEnabled)
        {
            // Nếu bật và chưa có -> thêm mới
            if (existingRp == null)
            {
                _dbContext.RolePermissions.Add(new RolePermission
                {
                    RoleId = request.RoleId,
                    PermissionId = permission.Id
                });
            }
        }
        else
        {
            // Nếu tắt và đã có -> xóa
            if (existingRp != null)
            {
                _dbContext.RolePermissions.Remove(existingRp);
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
```

### 3.4 Command: AssignUserRoleCommand
```csharp
// Application/Users/Commands/AssignUserRoleCommand.cs
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;

namespace SmartWMS.Application.Users.Commands;

// Có thể dùng một class Result<T> để bọc kết quả, ở đây dùng tạm boolean/string để đơn giản hóa.
public record AssignUserRoleCommand(string UserId, string NewRoleName) : IRequest<Result>;

public class Result
{
    public bool IsSuccess { get; set; }
    public string? ErrorMessage { get; set; }
    public static Result Success() => new() { IsSuccess = true };
    public static Result Failure(string message) => new() { IsSuccess = false, ErrorMessage = message };
}

public class AssignUserRoleCommandValidator : AbstractValidator<AssignUserRoleCommand>
{
    public AssignUserRoleCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.NewRoleName).NotEmpty();
    }
}

public class AssignUserRoleCommandHandler : IRequestHandler<AssignUserRoleCommand, Result>
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;

    public AssignUserRoleCommandHandler(UserManager<IdentityUser> userManager, RoleManager<IdentityRole> roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task<Result> Handle(AssignUserRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return Result.Failure("User not found");

        var roleExists = await _roleManager.RoleExistsAsync(request.NewRoleName);
        if (!roleExists)
            return Result.Failure("Role does not exist");

        var currentRoles = await _userManager.GetRolesAsync(user);

        // Remove current roles
        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
        if (!removeResult.Succeeded)
            return Result.Failure("Failed to remove old roles");

        // Add new role
        var addResult = await _userManager.AddToRoleAsync(user, request.NewRoleName);
        if (!addResult.Succeeded)
            return Result.Failure("Failed to assign new role");

        return Result.Success();
    }
}
```

## 4. Tầng API (Controllers)

```csharp
// WebApi/Controllers/PermissionController.cs
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Permissions.Commands;
using SmartWMS.Application.Permissions.Queries;
using SmartWMS.Application.Users.Commands;

namespace SmartWMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class PermissionController : ControllerBase
{
    private readonly IMediator _mediator;

    public PermissionController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Lấy ma trận quyền hạn để build bảng (Matrix Grid)
    /// </summary>
    [HttpGet("matrix")]
    public async Task<IActionResult> GetPermissionMatrix()
    {
        var result = await _mediator.Send(new GetPermissionMatrixQuery());
        return Ok(result);
    }

    /// <summary>
    /// Cập nhật thay đổi trạng thái (Toggle) của 1 quyền cho 1 vai trò
    /// </summary>
    [HttpPost("update-role-permission")]
    public async Task<IActionResult> UpdateRolePermission([FromBody] UpdateRolePermissionCommand command)
    {
        var success = await _mediator.Send(command);
        if (!success)
            return BadRequest("Thao tác thất bại. RoleId hoặc PermissionKey không hợp lệ.");

        return Ok("Cập nhật quyền hạn thành công.");
    }

    /// <summary>
    /// Gán vai trò hệ thống mới cho nhân viên
    /// </summary>
    [HttpPost("assign-role")]
    public async Task<IActionResult> AssignUserRole([FromBody] AssignUserRoleCommand command)
    {
        var result = await _mediator.Send(command);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.ErrorMessage });

        return Ok(new { message = "Gán vai trò thành công." });
    }
}
```
