using System;

namespace SmartWMS.Application.Features.Bins.DTOs.Queries;

public class BinPaginatedByZoneIdRequest
{
    public Guid? ZoneId { get; set; } // Chuyển sang Nullable Guid?
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SearchTerm { get; set; }
}