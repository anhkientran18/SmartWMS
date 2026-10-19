using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.Bins.Commands.CreateBin;

public record CreateBinCommand(CreateBinRequest RequestData) : IRequest<Result<Guid>>;