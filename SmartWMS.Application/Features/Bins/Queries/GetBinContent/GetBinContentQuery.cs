using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs;
using SmartWMS.Application.Features.Bins.DTOs.Queries;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent;

public record GetBinContentQuery(BinContentQueryRequest RequestData) : IRequest<Result<BinContentHeaderDto>>;