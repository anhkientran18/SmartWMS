using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetInboundReceiptById;

public record GetInboundReceiptByIdQuery(InboundReceiptByIdQueryRequest RequestData) : IRequest<Result<InboundReceiptDto>>;