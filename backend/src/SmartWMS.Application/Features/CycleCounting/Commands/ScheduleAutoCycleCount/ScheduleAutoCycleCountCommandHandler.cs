using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ScheduleAutoCycleCount;

public sealed class ScheduleAutoCycleCountCommandHandler : IRequestHandler<ScheduleAutoCycleCountCommand, Result<bool>>
{
    public Task<Result<bool>> Handle(ScheduleAutoCycleCountCommand request, CancellationToken cancellationToken) =>
        Task.FromResult(Result<bool>.Failure(ErrorCodeConstants.ValidationError,
            "UNSUPPORTED: Lập lịch kiểm kê tự động chưa được triển khai; không có lịch nào được tạo."));
}
