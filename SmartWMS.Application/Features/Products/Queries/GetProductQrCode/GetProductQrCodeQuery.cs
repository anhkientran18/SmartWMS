using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Products.Queries.GetProductQrCode;

public record GetProductQrCodeQuery(string Sku) : IRequest<Result<string>>;