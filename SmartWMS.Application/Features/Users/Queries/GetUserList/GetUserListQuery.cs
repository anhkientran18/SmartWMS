using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Users.DTOs;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Users.Queries.GetUserList;

// Định nghĩa Query yêu cầu trả về Result chứa danh sách UserDto
public record GetUserListQuery : IRequest<Result<List<UserDto>>>;