using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.CreateInboundReceipt;

public record CreateInboundReceiptCommand(CreateInboundReceiptRequest RequestData) : IRequest<Result<Guid>>;