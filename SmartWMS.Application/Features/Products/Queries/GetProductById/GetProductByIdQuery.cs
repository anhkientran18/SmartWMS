using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Dtos;

namespace SmartWMS.Application.Features.Products.Queries;

public record GetProductByIdQuery(Guid Id) : IRequest<Result<ProductDto>>;