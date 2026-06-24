using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.Bins.Commands.UpdateBin;

public class UpdateBinCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public double MaxCapacity { get; set; }
}