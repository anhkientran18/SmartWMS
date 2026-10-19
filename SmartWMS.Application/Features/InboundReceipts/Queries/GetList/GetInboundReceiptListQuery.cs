using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetList;

public record GetInboundReceiptListQuery(InboundReceiptListQueryRequest RequestData) : IRequest<Result<List<InboundReceiptDto>>>;