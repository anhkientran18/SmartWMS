using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using SmartWMS.Application.Features.Products.DTOs.Queries;

namespace SmartWMS.Application.Features.Products.Queries.GetProductById;

public record GetProductByIdQuery(ProductByIdQueryRequest RequestData) : IRequest<Result<ProductDto>>;