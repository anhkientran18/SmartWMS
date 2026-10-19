using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Suppliers.Specifications.Commands;

public sealed class SupplierInboundCheckForDeleteSpec : Specification<InboundReceipt>
{
    public SupplierInboundCheckForDeleteSpec(Guid supplierId)
    {
        AndCriteria(x => x.SupplierId == supplierId);
        AsNoTracking = true;
    }
}