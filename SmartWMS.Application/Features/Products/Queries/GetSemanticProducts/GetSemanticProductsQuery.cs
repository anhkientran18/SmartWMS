using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Queries.GetSemanticProducts.Dtos;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;

public class GetSemanticProductsQuery : IRequest<Result<List<ProductResultDto>>>
{
    // Nội dung tìm kiếm tự nhiên của người dùng (Ví dụ: "Thiết bị lưu trữ ThinkPad")
    public string SearchText { get; set; } = string.Empty;
}