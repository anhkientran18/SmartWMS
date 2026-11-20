using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Products.Specifications.Commands;

public sealed class ProductByIdForDeleteSpec : Specification<Product>
{
    public ProductByIdForDeleteSpec(Guid id)
    {
        AndCriteria(x => x.Id == id);
        EnableTracking(); // Cần tracking để xóa
    }
}