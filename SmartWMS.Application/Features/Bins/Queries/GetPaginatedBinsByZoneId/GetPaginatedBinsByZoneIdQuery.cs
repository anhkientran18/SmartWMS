using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs;
using SmartWMS.Application.Features.Bins.DTOs.Queries;

namespace SmartWMS.Application.Features.Bins.Queries.GetPaginatedBinsByZoneId;

public record GetPaginatedBinsByZoneIdQuery(BinPaginatedByZoneIdRequest RequestData) : IRequest<Result<PaginatedResult<BinDto>>>;