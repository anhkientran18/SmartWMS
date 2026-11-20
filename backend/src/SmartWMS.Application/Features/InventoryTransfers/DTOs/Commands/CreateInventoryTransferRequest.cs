using System;

namespace SmartWMS.Application.Features.InventoryTransfers.DTOs.Commands;

public class CreateInventoryTransferRequest
{
    public Guid ProductId { get; set; }
    public Guid SourceBinId { get; set; }
    public Guid DestinationBinId { get; set; }
    public int TransferQuantity { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public string Reason { get; set; } = "Luân chuyển nội bộ";
}