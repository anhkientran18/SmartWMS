using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Utils;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SmartWMS.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IApplicationDbContext _context; // Inject Database Context

    public AuthController(IConfiguration configuration, IApplicationDbContext context)
    {
        _configuration = configuration;
        _context = context;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // 1. Mã hóa mật khẩu người dùng nhập vào để so sánh với DB
        var hashPassword = SecurityUtils.HashPassword(request.Password);

        // 2. Truy vấn Database (Kiểm tra Account & Password & Trạng thái hoạt động)
        var user = await _context.Users.FirstOrDefaultAsync(
            u => u.Username == request.Username &&
                 u.PasswordHash == hashPassword &&
                 u.IsActive == true);

        if (user == null)
        {
            return Unauthorized(new { isSuccess = false, message = "Tài khoản không tồn tại, sai mật khẩu hoặc đã bị khóa." });
        }

        // 3. Tạo Token chuẩn với Role thực tế từ DB
        var token = GenerateJwtToken(user.Username, user.Role, user.Id.ToString());

        return Ok(new
        {
            isSuccess = true,
            data = new { accessToken = token, username = user.Username, fullName = user.FullName, role = user.Role },
            message = "Đăng nhập thành công."
        });
    }

    [Authorize]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        return Ok(new { isSuccess = true, message = "Đăng xuất thành công. Vui lòng xóa Token ở phía Client." });
    }

    private string GenerateJwtToken(string username, string role, string userId)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = Encoding.UTF8.GetBytes(jwtSettings["Secret"]!);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId), // Lưu ID thực tế của User vào Token
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Role, role)
        };

        var key = new SymmetricSecurityKey(secretKey);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"], audience: jwtSettings["Audience"],
            claims: claims, expires: DateTime.Now.AddMinutes(Convert.ToDouble(jwtSettings["ExpiryMinutes"])),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}