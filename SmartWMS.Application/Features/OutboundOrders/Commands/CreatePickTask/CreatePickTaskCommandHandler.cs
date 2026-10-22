using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;

public sealed class CreatePickTaskCommandHandler(OutboundLifecycle lifecycle) : IRequestHandler<CreatePickTaskCommand, Result<bool>>
{
    public Task<Result<bool>> Handle(CreatePickTaskCommand request, CancellationToken ct) =>
        lifecycle.AllocateAsync(request.RequestData.OutboundOrderId, request.RequestData.AssignedUserId, ct);
}
