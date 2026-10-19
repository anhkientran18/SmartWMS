using System;

namespace SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;

public class InventoryTransferByIdRequest
{
    public Guid Id { get; set; }
}