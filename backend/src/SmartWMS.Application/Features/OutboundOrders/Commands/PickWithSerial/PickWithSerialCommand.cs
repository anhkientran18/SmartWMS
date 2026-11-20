using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;

public record PickWithSerialCommand(PickWithSerialRequest RequestData) : IRequest<Result<List<string>>>;