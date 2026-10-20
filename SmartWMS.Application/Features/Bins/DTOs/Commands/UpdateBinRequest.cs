using System;

namespace SmartWMS.Application.Features.Bins.DTOs.Commands;

public class UpdateBinRequest
{
    public SmartWMS.Domain.Enums.BinPurpose? Purpose { get; set; }
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public double MaxCapacity { get; set; }
}