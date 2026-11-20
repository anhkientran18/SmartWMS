using System.Collections.Generic;

namespace SmartWMS.Application.Features.CycleCounting.DTOs.Commands;

public class CycleCountSummaryDto
{
    public string BatchCode { get; set; } = string.Empty;
    public int TotalBinsTargeted { get; set; }
    public List<string> TargetedBinCodes { get; set; } = new();
    public string AutoAssignmentOperator { get; set; } = string.Empty;
}