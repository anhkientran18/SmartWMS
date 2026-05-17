using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.Products.Queries;

public class SemanticSearchProductsQueryHandler
    : IRequestHandler<SemanticSearchProductsQuery, Result<List<SemanticSearchResultDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly IEmbeddingService _embeddingService;

    public SemanticSearchProductsQueryHandler(IApplicationDbContext context, IEmbeddingService embeddingService)
    {
        _context = context;
        _embeddingService = embeddingService;
    }

    public async Task<Result<List<SemanticSearchResultDto>>> Handle(
        SemanticSearchProductsQuery request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.SearchText))
            return Result<List<SemanticSearchResultDto>>.Failure("Nội dung tìm kiếm không được để trống.");

        // 1. Tạo Vector từ câu tìm kiếm của người dùng thông qua AI
        var queryVector = await _embeddingService.GenerateEmbeddingAsync(request.SearchText);

        // 2. Lấy danh sách sản phẩm thực tế từ DB để so khớp
        var products = await _context.Products.AsNoTracking().ToListAsync(cancellationToken);
        var searchResults = new List<SemanticSearchResultDto>();

        foreach (var product in products)
        {
            // Kết hợp Tên và Mô tả để làm giàu ngữ cảnh cho sản phẩm
            string productContent = $"{product.Name} {product.Description}";

            // Tạo Vector đại diện cho sản phẩm (Trong thực tế nên lưu Vector này vào DB để tối ưu tốc độ)
            var productVector = await _embeddingService.GenerateEmbeddingAsync(productContent);

            // 3. Tính toán độ tương đồng ngữ nghĩa giữa câu tìm kiếm và sản phẩm
            double similarity = _embeddingService.CalculateCosineSimilarity(queryVector, productVector);

            // Chỉ lấy các sản phẩm có độ trùng khớp lớn hơn ngưỡng tối thiểu đặt ra
            if (similarity >= request.MinScore)
            {
                searchResults.Add(new SemanticSearchResultDto
                {
                    Id = product.Id,    
                    SKU = product.SKU,
                    Name = product.Name,
                    Description = product.Description ?? string.Empty,
                    SimilarityScore = Math.Round(similarity * 100, 2) // Quy đổi ra %
                });
            }
        }

        // 4. Sắp xếp kết quả: Sản phẩm nào có ngữ nghĩa giống nhất xếp lên đầu
        var finalResult = searchResults.OrderByDescending(r => r.SimilarityScore).ToList();

        return Result<List<SemanticSearchResultDto>>.Success(finalResult);
    }
}