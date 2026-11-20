using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Auth.DTOs;

namespace SmartWMS.Application.Features.Auth.Commands.Login;

public record LoginCommand(LoginRequest Request) : IRequest<Result<LoginResponse>>;