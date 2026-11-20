using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking;

public record ProcessCrossDockingCommand(ProcessCrossDockRequest RequestData) : IRequest<Result<CrossDockResultDto>>;