using MediatR;
using Microsoft.Extensions.Caching.Memory;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using SmartWMS.Application.Features.Products.Models;
using SmartWMS.Application.Features.Products.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;

public sealed class GetSemanticProductsQueryHandler : IRequestHandler<GetSemanticProductsQuery, Result<List<ProductResultDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmbeddingService _embeddingService;
    private readonly IMemoryCache _memoryCache;
    private const string ProductEmbeddingsCacheKey = "SmartWMS_Product_Embeddings_Registry";

    public GetSemanticProductsQueryHandler(IUnitOfWork unitOfWork, IEmbeddingService embeddingService, IMemoryCache memoryCache)
    {
        _unitOfWork = unitOfWork;
        _embeddingService = embeddingService;
        _memoryCache = memoryCache;
    }

    public async Task<Result<List<ProductResultDto>>> Handle(GetSemanticProductsQuery request, CancellationToken cancellationToken)
    {
        float[] queryVector = await _embeddingService.GenerateEmbeddingAsync(request.RequestData.SearchText);

        if (queryVector == null || queryVector.Length == 0)
        {
            return Result<List<ProductResultDto>>.Failure("AI_ERR", "Hệ thống trí tuệ nhân tạo đang bận xử lý dữ liệu.");
        }

        if (!_memoryCache.TryGetValue(ProductEmbeddingsCacheKey, out List<ProductVectorCacheModel>? cachedVectors))
        {
            var repo = _unitOfWork.Repository<Product>();
            var spec = new ProductWithEmbeddingSpec();
            var productsInDb = await repo.ListAsync(spec, cancellationToken);

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
                        SKU = product.SKU,
                        Name = product.Name,
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
            foreach (var item in cachedVectors)
            {
                if (item.Embedding.Length != queryVector.Length) continue;

                double similarityScore = _embeddingService.CalculateCosineSimilarity(queryVector, item.Embedding);

                if (similarityScore >= 0.65)
                {
                    searchResults.Add(new ProductResultDto
                    {
                        Id = item.Id,
                        SKU = item.SKU,
                        Name = item.Name,
                        Description = item.Description,
                        SimilarityScore = Math.Round(similarityScore * 100, 2)
                    });
                }
            }
        }

        var finalResult = searchResults.OrderByDescending(x => x.SimilarityScore).ToList();
        return Result<List<ProductResultDto>>.Success(finalResult);
    }
}