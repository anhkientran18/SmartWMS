using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory; // BỔ SUNG: Để xử lý hủy bỏ Cache cũ (Cache Invalidation)
using Microsoft.Extensions.Localization;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Localization;
using System;
using System.Linq;
using System.Text.Json; // BỔ SUNG: Để mã hóa mảng float[] sang chuỗi JSON lưu xuống DB
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Commands.Create;

public class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly IEmbeddingService _embeddingService; // BỔ SUNG: Dịch vụ AI sinh Vector
    private readonly IMemoryCache _memoryCache;           // BỔ SUNG: Dịch vụ quản lý bộ nhớ đệm RAM

    private const string ProductEmbeddingsCacheKey = "SmartWMS_Product_Embeddings_Registry";

    // CẬP NHẬT: Inject đầy đủ các thành phần hạ tầng thông minh thông qua Constructor
    public CreateProductCommandHandler(
        IApplicationDbContext context,
        IStringLocalizer<SharedResource> localizer,
        IEmbeddingService embeddingService,
        IMemoryCache memoryCache)
    {
        _context = context;
        _localizer = localizer;
        _embeddingService = embeddingService;
        _memoryCache = memoryCache;
    }

    public async Task<Result<Guid>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra SKU trùng lặp dưới hệ thống DB
        var isSkuExists = await _context.Products
            .AnyAsync(p => p.SKU == request.SKU, cancellationToken);

        if (isSkuExists)
        {
            return Result<Guid>.Failure("Mã SKU này đã tồn tại trong hệ thống mMDM.");
        }

        // Kiểm tra tránh trùng mã vạch (Barcode) gây lỗi Unique Index độc bản của SQL Server
        var isBarcodeExists = await _context.Products
            .AnyAsync(p => p.Barcode == request.Barcode, cancellationToken);

        if (isBarcodeExists)
        {
            return Result<Guid>.Failure("Mã vạch (Barcode) này đã tồn tại trên một sản phẩm khác.");
        }

        // BỔ SUNG LOGIC AI CHUẨN DOANH NGHIỆP: Tự động tạo dữ liệu Vector Embedding ngữ nghĩa
        // Kết hợp tên và mô tả sản phẩm để tạo bối cảnh ngữ nghĩa đầy đủ nhất cho AI học lệnh
        string textToEmbed = $"{request.Name ?? string.Empty} {request.Description ?? string.Empty}";
        float[] generatedVector = await _embeddingService.GenerateEmbeddingAsync(textToEmbed);

        string? embeddingJson = null;
        if (generatedVector != null && generatedVector.Length > 0)
        {
            // Chuyển đổi mảng số thực float[] sang chuỗi định dạng JSON thô
            embeddingJson = JsonSerializer.Serialize(generatedVector);
        }

        // 2. Khởi tạo thực thể dữ liệu Product
        var product = new Product
        {
            Id = Guid.NewGuid(),
            SKU = request.SKU ?? string.Empty,
            Barcode = request.Barcode ?? string.Empty,
            Name = request.Name ?? string.Empty,
            Unit = request.Unit ?? string.Empty,
            Description = request.Description ?? string.Empty,
            DescriptionEmbeddingJson = embeddingJson // Lưu mảng Vector số hóa thông minh xuống Database
        };

        _context.Products.Add(product);

        // Kích hoạt cơ chế lưu trữ (Lưu Audit Log, User tác động tự động)
        await _context.SaveChangesAsync(cancellationToken);

        // BỔ SUNG QUAN TRỌNG: Thực thi chiến lược "Cache Invalidation"
        // Xóa sạch vùng nhớ đệm cũ trên RAM để ép tính năng Semantic Search tự động đồng bộ lại 
        // dữ liệu của sản phẩm mới tạo này ở lượt truy vấn kế tiếp mà không cần khởi động lại Server.
        _memoryCache.Remove(ProductEmbeddingsCacheKey);

        return Result<Guid>.Success(product.Id, "Thêm mới sản phẩm vào danh mục thành công và đồng bộ dữ liệu AI Vector.");
    }
}