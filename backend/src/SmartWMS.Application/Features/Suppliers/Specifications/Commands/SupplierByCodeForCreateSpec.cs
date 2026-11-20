using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Suppliers.Specifications.Commands;

public sealed class SupplierByCodeForCreateSpec : Specification<Supplier>
{
    public SupplierByCodeForCreateSpec(string code)
    {
        AndCriteria(x => x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}
