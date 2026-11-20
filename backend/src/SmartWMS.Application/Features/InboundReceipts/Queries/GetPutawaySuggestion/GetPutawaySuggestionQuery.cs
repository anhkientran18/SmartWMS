using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion;

public record GetPutawaySuggestionQuery(PutawaySuggestionRequest RequestData) : IRequest<Result<PutawaySuggestionDto>>;