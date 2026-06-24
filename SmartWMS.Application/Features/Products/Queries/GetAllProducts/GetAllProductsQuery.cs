using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Dtos; // Thống nhất dùng namespace Dtos viết thường chữ 'tos'

namespace SmartWMS.Application.Features.Products.Queries.GetAllProducts;

// Record định nghĩa lệnh lấy toàn bộ danh mục sản phẩm (Không cần tham số đầu vào)
public record GetAllProductsQuery : IRequest<Result<List<ProductDto>>>;