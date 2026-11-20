using System;

namespace SmartWMS.Application.Features.Dashboard.DTOs.Queries;

public class WarehouseDashboardQueryRequest
{
    public Guid? WarehouseId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}