using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask.Dtos; // Import namespace chứa DTO vừa tách
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;

public class CreatePickTaskCommand : IRequest<Result<PickTaskResultDto>>
{
    public Guid ProductId { get; set; }
    public int RequestedQuantity { get; set; }
}