using System;

namespace SmartWMS.Application.Features.Dashboard.DTOs.Queries;

public class DashboardInsightQueryRequest
{
    public Guid? WarehouseId { get; set; }
}