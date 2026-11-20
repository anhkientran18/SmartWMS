using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Products.Specifications.Queries;

public class ProductWithEmbeddingSpec : Specification<Product>
{
    public ProductWithEmbeddingSpec()
    {
        // Lấy tất cả sản phẩm đã được nhúng vector
        AndCriteria(p => !p.IsDeleted && p.DescriptionEmbeddingJson != null && p.DescriptionEmbeddingJson != "");
        AsNoTracking = true;
    }
}
