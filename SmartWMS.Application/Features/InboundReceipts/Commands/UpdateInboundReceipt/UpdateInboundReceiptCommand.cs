using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.UpdateInboundReceipt;

public record UpdateInboundReceiptCommand(UpdateInboundReceiptRequest RequestData) : IRequest<Result<bool>>;    