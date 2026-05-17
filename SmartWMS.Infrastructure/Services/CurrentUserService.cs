using Microsoft.AspNetCore.Http;
using SmartWMS.Application.Common.Interfaces;
using System.Security.Claims;

namespace SmartWMS.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    // Đọc UserId từ Claim loại 'sub' hoặc 'NameIdentifier' trong JWT
    public string? UserId => _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                            ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue("sub");

    // Đọc quyền hành của người dùng
    public string? Role => _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Role);
}