using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Users.Dtos;

namespace SmartWMS.Application.Features.Users.Queries.GetAllUsers;

public record GetAllUsersQuery : IRequest<Result<List<UserDto>>>;