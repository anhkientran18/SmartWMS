using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Suppliers.Specifications.Commands;

public sealed class SupplierByCodeForUpdateSpec : Specification<Supplier>
{
    public SupplierByCodeForUpdateSpec(Guid currentSupplierId, string code)
    {
        AndCriteria(x => x.Id != currentSupplierId && x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}