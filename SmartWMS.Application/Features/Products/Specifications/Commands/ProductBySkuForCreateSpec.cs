using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Products.Specifications.Commands;

public sealed class ProductBySkuForCreateSpec : Specification<Product>
{
    public ProductBySkuForCreateSpec(string sku)
    {
        AndCriteria(x => x.SKU.ToLower() == sku.ToLower());
        AsNoTracking = true; // Tối ưu tốc độ đọc khi chỉ cần kiểm tra tồn tại
    }
}