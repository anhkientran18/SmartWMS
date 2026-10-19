using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Kitting.DTOs.Commands;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit;

public record AssembleKitCommand(AssembleKitRequest RequestData) : IRequest<Result<bool>>;