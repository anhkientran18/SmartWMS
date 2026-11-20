using System;

namespace SmartWMS.Application.Features.Bins.DTOs.Queries;

public class BinListQueryRequest
{
    public Guid? ZoneId { get; set; }
    public string? SearchKeyword { get; set; }
}