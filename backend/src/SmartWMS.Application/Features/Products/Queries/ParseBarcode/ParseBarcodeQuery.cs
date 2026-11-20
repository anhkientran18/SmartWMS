using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using SmartWMS.Application.Features.Products.DTOs.Queries;

namespace SmartWMS.Application.Features.Products.Queries.ParseBarcode;

public record ParseBarcodeQuery(ParseBarcodeRequest RequestData) : IRequest<Result<ParsedBarcodeDto>>;