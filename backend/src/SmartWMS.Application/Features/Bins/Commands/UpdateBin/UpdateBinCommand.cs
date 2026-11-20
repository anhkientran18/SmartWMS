using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs.Commands;

namespace SmartWMS.Application.Features.Bins.Commands.UpdateBin;

public record UpdateBinCommand(UpdateBinRequest RequestData) : IRequest<Result<bool>>;