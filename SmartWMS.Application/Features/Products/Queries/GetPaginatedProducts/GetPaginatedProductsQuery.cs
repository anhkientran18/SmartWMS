using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Dtos; // Thống nhất quy ước namespace Dtos viết thường

namespace SmartWMS.Application.Features.Products.Queries.GetPaginatedProducts;

public record GetPaginatedProductsQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchKeyword = null) : IRequest<Result<ProductPaginationDto>>;