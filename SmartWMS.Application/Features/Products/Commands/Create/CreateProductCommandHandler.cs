using MediatR;
using Microsoft.Extensions.Caching.Memory;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
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

        // 2. Logic AI nhúng Vector
        string textToEmbed = $"{reqData.Name} {reqData.Description}";
        float[] generatedVector = await _embeddingService.GenerateEmbeddingAsync(textToEmbed, cancellationToken);
        string? embeddingJson = generatedVector != null && generatedVector.Length > 0
            ? JsonSerializer.Serialize(generatedVector) : null;

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

        return Result<Guid>.Success(product.Id, "Thêm mới sản phẩm thành công.");
    }
}