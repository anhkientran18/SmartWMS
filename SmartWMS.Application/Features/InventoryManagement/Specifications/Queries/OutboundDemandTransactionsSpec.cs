using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Queries;

public sealed class OutboundDemandTransactionsSpec : Specification<InventoryTransaction>
{
    public OutboundDemandTransactionsSpec(DateTime since)
    {
        AndCriteria(x => x.CreatedAt >= since && x.QuantityChanged < 0 &&
            (x.TransactionType == "OUTBOUND" || x.TransactionType == "WAVE_OUTBOUND" ||
             x.TransactionType == "OUTBOUND_SERIAL"));
    }
}
