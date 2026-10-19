using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Auth.DTOs;

namespace SmartWMS.Application.Features.Auth.Commands.Logout;

public record LogoutCommand(LogoutRequest Request) : IRequest<Result<bool>>;