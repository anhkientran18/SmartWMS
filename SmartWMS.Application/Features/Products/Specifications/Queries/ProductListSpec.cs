using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Products.Specifications.Queries;

public class ProductListSpec : Specification<Product>
{
    public ProductListSpec(string? keyword)
    {
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(p => p.Name.Contains(search) ||
                             p.SKU.Contains(search) ||
                             p.Barcode.Contains(search));
        }

        ApplyOrderByDescending(p => p.CreatedAt);
        AsNoTracking = true;
    }
}