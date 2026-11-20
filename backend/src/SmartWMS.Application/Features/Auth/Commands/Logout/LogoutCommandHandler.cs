using MediatR;
using SmartWMS.Application.Common.Models;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Auth.Commands.Logout;

public sealed class LogoutCommandHandler : IRequestHandler<LogoutCommand, Result<bool>>
{
    public Task<Result<bool>> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        return Task.FromResult(Result<bool>.Success(true, "Đăng xuất thành công."));
    }
}