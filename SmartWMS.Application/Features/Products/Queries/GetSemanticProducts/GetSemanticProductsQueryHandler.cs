using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Queries.GetSemanticProducts.Dtos;
using SmartWMS.Application.Features.Products.Queries.GetSemanticProducts.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;

public class GetSemanticProductsQueryHandler : IRequestHandler<GetSemanticProductsQuery, Result<List<ProductResultDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly IEmbeddingService _embeddingService;
    private readonly IMemoryCache _memoryCache;

    private const string ProductEmbeddingsCacheKey = "SmartWMS_Product_Embeddings_Registry";

    public GetSemanticProductsQueryHandler(
        IApplicationDbContext context,
        IEmbeddingService embeddingService,
        IMemoryCache memoryCache)
    {
        _context = context;
        _embeddingService = embeddingService;
        _memoryCache = memoryCache;
    }

    public async Task<Result<List<ProductResultDto>>> Handle(GetSemanticProductsQuery request, CancellationToken cancellationToken)
    {
        // Bước A: Số hóa chuỗi tìm kiếm tự nhiên sang mảng Vector (768 chiều)
        float[] queryVector = await _embeddingService.GenerateEmbeddingAsync(request.SearchText);

        if (queryVector == null || queryVector.Length == 0)
        {
            return Result<List<ProductResultDto>>.Failure("Hệ thống trí tuệ nhân tạo đang bận xử lý dữ liệu.");
        }

        // Bước B: Kiểm tra tính sẵn sàng của dữ liệu In-Memory Cache trên RAM Server
        if (!_memoryCache.TryGetValue(ProductEmbeddingsCacheKey, out List<ProductVectorCacheModel>? cachedVectors))
        {
            var productsInDb = await _context.Products
                .Where(p => p.DescriptionEmbeddingJson != null && p.DescriptionEmbeddingJson != string.Empty)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            cachedVectors = new List<ProductVectorCacheModel>();

            foreach (var product in productsInDb)
            {
                try
                {
                    float[]? parsedVector = JsonSerializer.Deserialize<float[]>(product.DescriptionEmbeddingJson!);
                    if (parsedVector == null) continue;

                    cachedVectors.Add(new ProductVectorCacheModel
                    {
                        Id = product.Id,
                        SKU = product.SKU ?? string.Empty,
                        Name = product.Name ?? string.Empty,
                        Description = product.Description ?? string.Empty,
                        Embedding = parsedVector
                    });
                }
                catch (JsonException) { continue; }
            }

            var cacheEntryOptions = new MemoryCacheEntryOptions()
                .SetSlidingExpiration(TimeSpan.FromHours(2))
                .SetAbsoluteExpiration(TimeSpan.FromDays(1));

            _memoryCache.Set(ProductEmbeddingsCacheKey, cachedVectors, cacheEntryOptions);
        }

        var searchResults = new List<ProductResultDto>();

        if (cachedVectors != null)
        {
            // Bước C: Quét siêu tốc mảng dữ liệu RAM và tính toán độ tương đồng Cosine Similarity
            foreach (var item in cachedVectors)
            {
                if (item.Embedding.Length != queryVector.Length)
                    continue;

                double similarityScore = _embeddingService.CalculateCosineSimilarity(queryVector, item.Embedding);

                // Lọc điều kiện khắt khe: Ngưỡng khớp ngữ nghĩa doanh nghiệp thực tế đạt >= 65%
                if (similarityScore >= 0.65)
                {
                    searchResults.Add(new ProductResultDto
                    {
                        Id = item.Id,
                        SKU = item.SKU,
                        Name = item.Name,
                        Description = item.Description,
                        SimilarityScore = Math.Round(similarityScore * 100, 2) // Quy đổi ra đơn vị % trực quan
                    });
                }
            }
        }

        // Bước D: Sắp xếp giảm dần theo điểm số phần trăm tương đồng
        var finalResult = searchResults
            .OrderByDescending(x => x.SimilarityScore)
            .ToList();

        return Result<List<ProductResultDto>>.Success(finalResult);
    }
}