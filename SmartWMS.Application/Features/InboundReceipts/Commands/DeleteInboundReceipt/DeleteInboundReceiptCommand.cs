using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.DeleteInboundReceipt;

public record DeleteInboundReceiptCommand(DeleteInboundReceiptRequest RequestData) : IRequest<Result<bool>>;