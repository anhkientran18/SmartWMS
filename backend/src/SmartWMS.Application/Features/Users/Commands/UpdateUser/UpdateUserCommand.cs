using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Users.Commands;

public record UpdateUserCommand : IRequest<Result<bool>>
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public string? NewPassword { get; init; }
}