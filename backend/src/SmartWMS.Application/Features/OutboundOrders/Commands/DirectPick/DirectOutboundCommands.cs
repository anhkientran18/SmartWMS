using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.DirectPick;

public record DirectPickCommand(Guid OrderId, DirectPickRequest RequestData) : IRequest<Result<bool>>;
public record PackOutboundOrderCommand(Guid OrderId) : IRequest<Result<bool>>;

public sealed class DirectPickCommandHandler(OutboundLifecycle lifecycle) : IRequestHandler<DirectPickCommand, Result<bool>>
{
    public Task<Result<bool>> Handle(DirectPickCommand request, CancellationToken ct) => lifecycle.PickAsync(request.OrderId, request.RequestData, ct);
}
public sealed class PackOutboundOrderCommandHandler(OutboundLifecycle lifecycle) : IRequestHandler<PackOutboundOrderCommand, Result<bool>>
{
    public Task<Result<bool>> Handle(PackOutboundOrderCommand request, CancellationToken ct) => lifecycle.PackAsync(request.OrderId, ct);
}
