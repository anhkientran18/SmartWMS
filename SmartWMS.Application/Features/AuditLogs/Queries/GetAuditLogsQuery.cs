using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.AuditLogs.Queries.Dtos; // Import danh mục DTO mới tách

namespace SmartWMS.Application.Features.AuditLogs.Queries;

public record GetAuditLogsQuery(int PageNumber = 1, int PageSize = 20) : IRequest<Result<AuditLogPaginationDto>>;