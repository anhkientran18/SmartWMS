using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CrossDocking.Commands.ProcessCrossDock.Dtos; // Import namespace DTO mới tách
using System;

namespace SmartWMS.Application.Features.CrossDocking.Commands.ProcessCrossDock;

public class ProcessCrossDockCommand : IRequest<Result<CrossDockResultDto>>
{
    public Guid ProductId { get; set; }

    // Số lượng vừa hạ tải từ xe container nhà cung cấp tại Receiving Dock
    public int IncomingQuantity { get; set; }

    public string SourceDockCode { get; set; } = "RECEIVING_DOCK";
}