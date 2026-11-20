using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPaginatedCountSheets;

public record GetPaginatedCountSheetsQuery(CountSheetPaginatedRequest RequestData) : IRequest<Result<PaginatedResult<CycleCountSheetDto>>>;