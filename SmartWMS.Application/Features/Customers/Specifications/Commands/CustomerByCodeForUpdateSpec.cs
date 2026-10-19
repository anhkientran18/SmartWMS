using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Customers.Specifications.Commands;

public sealed class CustomerByCodeForUpdateSpec : Specification<Customer>
{
    public CustomerByCodeForUpdateSpec(Guid currentCustomerId, string code)
    {
        AndCriteria(x => x.Id != currentCustomerId && x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}