using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking.Dtos; // Import namespace DTO mới

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking;

public class ProcessCrossDockingCommand : IRequest<Result<CrossDockDirectiveDto>>
{
    public string SKU { get; set; } = string.Empty;
    public int ReceivedQuantity { get; set; }
}