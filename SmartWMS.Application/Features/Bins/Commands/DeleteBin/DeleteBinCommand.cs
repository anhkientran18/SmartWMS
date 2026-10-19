using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs.Commands;

namespace SmartWMS.Application.Features.Bins.Commands.DeleteBin;

public record DeleteBinCommand(DeleteBinRequest RequestData) : IRequest<Result<bool>>;