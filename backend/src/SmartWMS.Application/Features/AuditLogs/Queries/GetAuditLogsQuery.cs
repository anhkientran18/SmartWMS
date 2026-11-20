using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.AuditLogs.DTOs.Queries;

namespace SmartWMS.Application.Features.AuditLogs.Queries.GetAuditLogs;

public record GetAuditLogsQuery(AuditLogPaginatedRequest RequestData) : IRequest<Result<PaginatedResult<AuditLogDto>>>;