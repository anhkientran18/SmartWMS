using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Products.Specifications.Queries;

public sealed class ProductByIdSpec : Specification<Product>
{
    public ProductByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id);
        // Vì đây là truy vấn lấy dữ liệu để xem, AsNoTracking = true giúp tăng tốc độ đọc
        AsNoTracking = true;
    }
}