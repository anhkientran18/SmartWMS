using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Products.Specifications.Queries;

public class ProductBySkuSpec : Specification<Product>
{
    public ProductBySkuSpec(string sku)
    {
        AndCriteria(p => p.SKU == sku);
        AsNoTracking = true;
    }
}