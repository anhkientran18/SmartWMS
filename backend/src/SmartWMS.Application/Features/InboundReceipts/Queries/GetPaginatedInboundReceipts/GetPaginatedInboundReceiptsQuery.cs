using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPaginatedInboundReceipts;

// Đổi từ PaginatedListDto sang chuẩn chung PaginatedResult
public record GetPaginatedInboundReceiptsQuery(InboundReceiptPaginatedQueryRequest RequestData) : IRequest<Result<PaginatedResult<InboundReceiptDto>>>;