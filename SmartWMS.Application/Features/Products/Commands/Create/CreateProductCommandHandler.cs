using MediatR;
using Microsoft.Extensions.Caching.Memory;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Linq;
using System.Net.Http;
using SmartWMS.Application.Common.Exceptions;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Commands.Create;

public sealed class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmbeddingService _embeddingService;
    private readonly IMemoryCache _memoryCache;
    private const string ProductEmbeddingsCacheKey = "SmartWMS_Product_Embeddings_Registry";

    public CreateProductCommandHandler(IUnitOfWork unitOfWork, IEmbeddingService embeddingService, IMemoryCache memoryCache)
    {
        _unitOfWork = unitOfWork;
        _embeddingService = embeddingService;
        _memoryCache = memoryCache;
    }

    public async Task<Result<Guid>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Product>();
        var reqData = request.RequestData;

        // 1. Kiểm tra SKU bằng Specification
        var skuSpec = new ProductBySkuForCreateSpec(reqData.SKU);
        var existingProduct = await repo.GetEntityWithSpecAsync(skuSpec, cancellationToken);

        if (existingProduct != null)
        {
            return Result<Guid>.Failure(ErrorCodeConstants.SkuAlreadyExists, "Mã SKU này đã tồn tại trong hệ thống.");
        }

        // Embedding enriches the catalog; provider failure must not prevent core creation.
        // Keep caller cancellation and unexpected programming/storage failures observable.
        string? embeddingJson = null;
        try
        {
            var vector = await _embeddingService.GenerateEmbeddingAsync($"{reqData.Name} {reqData.Description}", cancellationToken);
            if (vector is { Length: 768 } && vector.All(float.IsFinite) && vector.Any(x => x != 0))
                embeddingJson = JsonSerializer.Serialize(vector);
        }
        catch (Exception ex) when (ex is AiDependencyException or HttpRequestException or TimeoutException ||
            ex is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            // Null is truthful unavailable enrichment, never a synthetic vector.
        }
        cancellationToken.ThrowIfCancellationRequested();

        // 3. Khởi tạo Entity
        var product = new Product
        {
            Id = Guid.NewGuid(),
            TrackingMode = reqData.TrackingMode,
            SKU = reqData.SKU,
            Barcode = reqData.Barcode,
            Name = reqData.Name,
            Unit = reqData.Unit,
            Description = reqData.Description,
            DescriptionEmbeddingJson = embeddingJson
        };

        // 4. Lưu dữ liệu qua UnitOfWork
        await repo.AddAsync(product, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // 5. Xóa Cache
        _memoryCache.Remove(ProductEmbeddingsCacheKey);

        return Result<Guid>.Success(product.Id, embeddingJson != null
            ? "Thêm mới sản phẩm thành công."
            : "Thêm mới sản phẩm thành công; embedding chưa sẵn sàng, sản phẩm chưa có trong tìm kiếm ngữ nghĩa.");
    }
}
