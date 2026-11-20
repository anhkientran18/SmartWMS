using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs.Queries;

namespace SmartWMS.Application.Features.Products.Queries.GetProductQrCode;

public record GetProductQrCodeQuery(ProductQrCodeQueryRequest RequestData) : IRequest<Result<string>>;