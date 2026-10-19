using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs;
using SmartWMS.Application.Features.Bins.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Bins.Queries.GetList;

public record GetBinListQuery(BinListQueryRequest RequestData) : IRequest<Result<List<BinDto>>>;