using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Customers.Specifications.Commands;

public sealed class CustomerByIdForUpdateSpec : Specification<Customer>
{
    public CustomerByIdForUpdateSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        EnableTracking(); // Bật Tracking để nhận diện thay đổi khi Update/Delete
    }
}