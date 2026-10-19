using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetCountSheetById;

public record GetCountSheetByIdQuery(CountSheetByIdRequest RequestData) : IRequest<Result<CycleCountSheetDto>>;