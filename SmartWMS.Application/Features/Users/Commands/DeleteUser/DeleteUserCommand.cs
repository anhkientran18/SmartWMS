using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Users.Commands;

public record DeleteUserCommand(Guid Id) : IRequest<Result<bool>>;