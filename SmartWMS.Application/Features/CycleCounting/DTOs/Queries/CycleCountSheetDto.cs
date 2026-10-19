using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

public class CycleCountSheetDto
{
    public Guid Id { get; set; }
    public string SheetNumber { get; set; } = string.Empty;
    public string BatchCode { get; set; } = string.Empty;
    public Guid? ZoneId { get; set; }
    public string ZoneName { get; set; } = string.Empty;
    public Guid? BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid? AssignedUserId { get; set; }
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public List<CycleCountSheetItemDto> Items { get; set; } = new();
}