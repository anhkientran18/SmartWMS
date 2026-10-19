using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Users.DTOs;

namespace SmartWMS.Application.Features.Users.Queries;

public record GetPaginatedUsersQuery(int PageNumber = 1, int PageSize = 10, string? SearchKeyword = null)
    : IRequest<Result<UserPaginationDto>>;