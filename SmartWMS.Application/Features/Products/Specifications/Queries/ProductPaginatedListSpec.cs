using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Products.Specifications.Queries;

public class ProductPaginatedListSpec : Specification<Product>
{
    public ProductPaginatedListSpec(string? keyword, int pageIndex, int pageSize)
    {
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(p => p.Name.Contains(search) ||
                             p.SKU.Contains(search) ||
                             p.Barcode.Contains(search));
        }

        ApplyOrderByDescending(p => p.CreatedAt);
        ApplyPaging((pageIndex - 1) * pageSize, pageSize);
        AsNoTracking = true;
    }
}