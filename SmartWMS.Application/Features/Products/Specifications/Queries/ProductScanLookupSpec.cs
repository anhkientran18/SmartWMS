using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Products.Specifications.Queries;

public sealed class ProductScanLookupSpec : Specification<Product>
{
    public ProductScanLookupSpec(string code, bool includeSku = true, bool includeBarcode = true)
    {
        AndCriteria(x => !x.IsDeleted &&
            ((includeSku && x.SKU == code) || (includeBarcode && x.Barcode == code)));
    }
}
