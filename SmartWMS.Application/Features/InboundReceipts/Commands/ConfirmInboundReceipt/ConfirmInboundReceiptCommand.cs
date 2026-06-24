using MediatR;
using SmartWMS.Application.Common.Models;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ConfirmInboundReceipt;

public class ConfirmInboundReceiptCommand : IRequest<Result<Guid>>
{
    public Guid BinId { get; set; }
    public Guid ProductId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public DateTime? ExpirationDate { get; set; }
    public int Quantity { get; set; }
}