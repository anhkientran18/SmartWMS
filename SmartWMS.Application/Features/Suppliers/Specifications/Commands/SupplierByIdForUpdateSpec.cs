using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Suppliers.Specifications.Commands;

public sealed class SupplierByIdForUpdateSpec : Specification<Supplier>
{
    public SupplierByIdForUpdateSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        EnableTracking(); // Bật Tracking để EF Core nhận diện khi Update/Delete
    }
}