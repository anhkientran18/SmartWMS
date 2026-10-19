using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Products.Specifications.Commands;

public sealed class ProductBySkuForUpdateSpec : Specification<Product>
{
    public ProductBySkuForUpdateSpec(Guid currentProductId, string sku)
    {
        AndCriteria(x => x.Id != currentProductId && x.SKU.ToLower() == sku.ToLower());
        AsNoTracking = true;
    }
}