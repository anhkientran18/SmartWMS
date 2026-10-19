using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;

public record CreateCountSheetCommand(CreateCountSheetRequest RequestData) : IRequest<Result<Guid>>;