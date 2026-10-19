using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;

public record CreatePickTaskCommand(CreatePickTaskRequest RequestData) : IRequest<Result<bool>>;