using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Specifications.Queries;

public sealed class InventoryTransferByIdSpec : Specification<InventoryTransaction>
{
    public InventoryTransferByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && x.TransactionType.ToUpper() == "TRANSFER");
        AddInclude(x => x.Product!);
        AsNoTracking = true;
    }
}