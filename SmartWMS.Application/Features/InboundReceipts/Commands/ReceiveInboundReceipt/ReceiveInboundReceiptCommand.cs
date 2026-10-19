using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ReceiveInboundReceipt;

public record ReceiveInboundReceiptCommand(ReceiveInboundReceiptRequest RequestData) : IRequest<Result<bool>>;