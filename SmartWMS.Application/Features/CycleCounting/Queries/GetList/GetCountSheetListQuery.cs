using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetList;

public record GetCountSheetListQuery(CountSheetListQueryRequest RequestData) : IRequest<Result<List<CycleCountSheetDto>>>;