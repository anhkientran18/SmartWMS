using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Auth.DTOs;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Auth.Commands.Login;

public sealed class LoginCommandHandler : IRequestHandler<LoginCommand, Result<LoginResponse>>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;

    public LoginCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        ITokenService tokenService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    public async Task<Result<LoginResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username == request.Request.Username, cancellationToken);

        if (user == null || !user.IsActive)
        {
            return Result<LoginResponse>.Failure(
                ErrorCodeConstants.Unauthorized,
                "Tài khoản không tồn tại, sai mật khẩu hoặc đã bị khóa.");
        }

        bool isPasswordValid = _passwordHasher.VerifyPassword(request.Request.Password, user.PasswordHash);
        if (!isPasswordValid)
        {
            return Result<LoginResponse>.Failure(
                ErrorCodeConstants.Unauthorized,
                "Tài khoản không tồn tại, sai mật khẩu hoặc đã bị khóa.");
        }

        string token = _tokenService.GenerateJwtToken(user);

        var response = new LoginResponse
        {
            Token = token,
            Username = user.Username,
            Role = user.Role ?? "Staff",
            FullName = $"{user.LastName} {user.FirstName}".Trim()
        };

        return Result<LoginResponse>.Success(response, "Đăng nhập thành công.");
    }
}