using MediatR;
using SmartWMS.Application.Common.Models;

public record CreateUserCommand : IRequest<Result<Guid>>
{
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;  // Thêm dòng này
    public string FirstName { get; init; } = string.Empty; // Thêm dòng này
    public string Role { get; init; } = string.Empty;
}