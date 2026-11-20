using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Products.Specifications.Commands;

public class ProductByIdForUpdateSpec : Specification<Product>
{
    public ProductByIdForUpdateSpec(Guid id)
    {
        AndCriteria(x => x.Id == id);
        EnableTracking(); // Bắt buộc bật Tracking để EF Core nhận diện thay đổi khi Update
    }
}