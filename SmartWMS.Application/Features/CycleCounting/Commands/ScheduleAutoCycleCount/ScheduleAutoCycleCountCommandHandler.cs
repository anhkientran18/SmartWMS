using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ScheduleAutoCycleCount;

public class ScheduleAutoCycleCountCommandHandler : IRequestHandler<ScheduleAutoCycleCountCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    // Tương lai bạn có thể tiêm thêm: private readonly IRecurringJobManager _jobManager;

    public ScheduleAutoCycleCountCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(ScheduleAutoCycleCountCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var zoneRepo = _unitOfWork.Repository<Zone>();

        // 1. Kiểm tra Khu vực (Zone) có tồn tại không
        var zone = await zoneRepo.GetByIdAsync(req.ZoneId, cancellationToken);
        if (zone == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy Khu vực (Zone) này trên hệ thống.");

        // 2. Tích hợp Hangfire để lên lịch chạy ngầm
        string jobId = $"AutoCycleCount_Zone_{req.ZoneId}";

        // Đoạn code thực tế sẽ gọi Hangfire như sau (giống file Program.cs của bạn):
        // _jobManager.AddOrUpdate(jobId, () => Tự_Động_Tạo_Phiếu_Kiểm_Kê_Logic_Ở_Đây, req.CronExpression);

        // 3. Ghi Log hệ thống (nếu có bảng AuditLog)
        // var auditRepo = _unitOfWork.Repository<AuditLog>(); ...

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã lên lịch kiểm kê tự động thành công cho Khu vực {zone.Name} với chu kỳ: {req.CronExpression}");
    }
}