using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Customers.Specifications.Commands;

public sealed class CustomerByCodeForCreateSpec : Specification<Customer>
{
    public CustomerByCodeForCreateSpec(string code)
    {
        AndCriteria(x => x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}