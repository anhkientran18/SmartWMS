using System;

namespace SmartWMS.Application.Features.CycleCounting.DTOs.Commands;

public class ScheduleAutoCycleCountRequest
{
    public Guid ZoneId { get; set; }

    // Sử dụng định dạng Cron để lên lịch (VD: "0 0 1 * *" -> Chạy vào ngày 1 hàng tháng)
    public string CronExpression { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;
}