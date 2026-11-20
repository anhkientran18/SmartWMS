using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Users.DTOs;

namespace SmartWMS.Application.Features.Users.Queries;

public record GetUserByIdQuery(Guid Id) : IRequest<Result<UserDto>>;